import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setToken, clearToken, hasToken } from '../api'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Token management', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hasToken returns false when no token', () => {
    expect(hasToken()).toBe(false)
  })

  it('setToken stores token in localStorage', () => {
    setToken('test-token-123')
    expect(hasToken()).toBe(true)
    expect(localStorage.getItem('dashboard_token')).toBe('test-token-123')
  })

  it('clearToken removes token from localStorage', () => {
    setToken('test-token')
    expect(hasToken()).toBe(true)
    clearToken()
    expect(hasToken()).toBe(false)
  })
})

describe('API requests', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetch.mockReset()
  })

  it('fetchReport includes Authorization header', async () => {
    setToken('my-token')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        generatedAt: '2026-08-28T12:00:00Z',
        totalConversations: 100,
        agents: [],
        labels: [],
      }),
    })

    const { fetchReport } = await import('../api')
    await fetchReport()

    // API_BASE is empty in test env, so URL is just /api/report
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/api/report')
    expect(callArgs[1].headers['Authorization']).toBe('Bearer my-token')
  })

  it('fetchReport with refresh adds query param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ agents: [], labels: [] }),
    })

    const { fetchReport } = await import('../api')
    await fetchReport(true)

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/api/report?refresh=1')
  })

  it('throws on 401 and clears token', async () => {
    setToken('bad-token')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const { fetchReport } = await import('../api')
    await expect(fetchReport()).rejects.toThrow('Token inválido ou expirado')
    expect(hasToken()).toBe(false)
  })

  it('throws on non-ok response with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve(JSON.stringify({ error: 'Server error' })),
    })

    const { fetchReport } = await import('../api')
    await expect(fetchReport()).rejects.toThrow('Server error')
  })
})
