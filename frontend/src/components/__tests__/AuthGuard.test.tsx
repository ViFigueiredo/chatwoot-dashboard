import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthGuard from '../AuthGuard'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('AuthGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetch.mockReset()
  })

  async function submitToken(onAuthenticated: () => void, value = 'algum-token') {
    render(<AuthGuard onAuthenticated={onAuthenticated} />)
    await userEvent.type(screen.getByPlaceholderText('Token de acesso'), value)
    await userEvent.click(screen.getByRole('button'))
  }

  it('valida o token contra o endpoint autenticado, não contra /api/health', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const onAuthenticated = vi.fn()

    await submitToken(onAuthenticated, 'token-bom')

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/auth-check')
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer token-bom',
    })
    expect(localStorage.getItem('dashboard_token')).toBe('token-bom')
  })

  it('rejeita token inválido: não autentica e não persiste o token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const onAuthenticated = vi.fn()

    await submitToken(onAuthenticated, 'token-errado')

    await waitFor(() => expect(screen.getByText('Token inválido')).toBeInTheDocument())
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(localStorage.getItem('dashboard_token')).toBeNull()
  })

  it('falha de rede não libera o acesso', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const onAuthenticated = vi.fn()

    await submitToken(onAuthenticated)

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível validar o token/)).toBeInTheDocument()
    )
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(localStorage.getItem('dashboard_token')).toBeNull()
  })

  it('não dispara requisição quando o campo está vazio', async () => {
    const onAuthenticated = vi.fn()
    render(<AuthGuard onAuthenticated={onAuthenticated} />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Digite o token de acesso')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(onAuthenticated).not.toHaveBeenCalled()
  })
})
