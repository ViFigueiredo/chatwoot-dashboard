import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProspection } from '../useProspection'
import type { DashboardData } from '@/types'

const mockData: DashboardData = {
  generatedAt: '2026-08-28T10:00:00Z',
  cutoffDate: '2026-08-01',
  labels: [{ title: 'Vendas', color: '#ff0000' }],
  teams: [],
  agentTeams: {},
  records: [
    { agente: 'João', data: '2026-08-15', hora: '10:30', diaSemana: 'Qui', conversaId: 1, telefone: '11999990000', contatoId: 10, status: 'open', labels: ['Vendas'], supervisores: [] },
    { agente: 'Maria', data: '2026-08-16', hora: '14:00', diaSemana: 'Sex', conversaId: 2, telefone: '11888880000', contatoId: 20, status: 'resolved', labels: [], supervisores: [] },
  ],
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

function mockFetchSuccess(data: DashboardData, delay = 0) {
  fetchSpy.mockImplementation(() =>
    new Promise((resolve) =>
      setTimeout(() =>
        resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
        }),
        delay,
      ),
    ),
  )
}

function mockFetchAbort() {
  fetchSpy.mockImplementation(() =>
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new DOMException('The operation was aborted', 'AbortError')
        reject(err)
      }, 50),
    ),
  )
}

describe('useProspection', () => {
  it('returns cached data immediately without loading', async () => {
    // Pre-populate cache
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    localStorage.setItem('chatwoot_prospection_cache_ts', Date.now().toString())

    // Mock fetch to return fresh data
    mockFetchSuccess(mockData)

    const { result } = renderHook(() => useProspection())

    // Should have cached data immediately
    expect(result.current.data).toEqual(mockData)
    expect(result.current.loading).toBe(false)
  })

  it('shows loading state when no cache exists', () => {
    mockFetchSuccess(mockData)

    const { result } = renderHook(() => useProspection())

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('fetches data and updates state on success', async () => {
    mockFetchSuccess(mockData)

    const { result } = renderHook(() => useProspection())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(result.current.isPartial).toBe(false)
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it('handles abort error gracefully with isPartial', async () => {
    mockFetchAbort()

    const { result } = renderHook(() => useProspection())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toContain('Análise')
    expect(result.current.isPartial).toBe(true) // Abort sets isPartial for polling
  })

  it('uses date-specific cache keys', () => {
    const data2026: DashboardData = { ...mockData, records: [mockData.records[0]] }
    localStorage.setItem('chatwoot_prospection_cache_2026-08-01_2026-08-15', JSON.stringify(data2026))
    localStorage.setItem('chatwoot_prospection_cache_ts_2026-08-01_2026-08-15', Date.now().toString())

    mockFetchSuccess(data2026)

    const { result } = renderHook(() => useProspection('2026-08-01', '2026-08-15'))

    expect(result.current.data).toEqual(data2026)
  })

  it('refresh calls fetchProspection with refresh=true', async () => {
    mockFetchSuccess(mockData)

    const { result } = renderHook(() => useProspection())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Clear spy call counts
    fetchSpy.mockClear()
    mockFetchSuccess({ ...mockData, records: [...mockData.records, mockData.records[0]] })

    await act(async () => {
      await result.current.refresh()
    })

    // Should have called with refresh=1
    expect(fetchSpy).toHaveBeenCalled()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('refresh=1')
  })

  it('stores data in localStorage after successful fetch', async () => {
    mockFetchSuccess(mockData)

    const { result } = renderHook(() => useProspection())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const cached = localStorage.getItem('chatwoot_prospection_cache')
    expect(cached).toBeTruthy()
    expect(JSON.parse(cached!)).toEqual(mockData)
  })

  it('refresh continues to work even after abort error', async () => {
    // First call aborts
    mockFetchAbort()

    const { result } = renderHook(() => useProspection())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toContain('Análise')

    // Second call succeeds
    mockFetchSuccess(mockData)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })
})
