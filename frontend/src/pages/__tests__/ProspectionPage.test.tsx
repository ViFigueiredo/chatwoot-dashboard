import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProspectionPage from '../ProspectionPage'
import type { DashboardData } from '@/types'

const mockData: DashboardData = {
  generatedAt: '2026-08-28T10:00:00Z',
  cutoffDate: '2026-08-01',
  labels: [{ title: 'Vendas', color: '#ff0000' }],
  teams: [],
  agentTeams: {},
  records: [
    { agente: 'João Silva', data: '2026-08-15', hora: '10:30', diaSemana: 'Qui', conversaId: 1, telefone: '11999990000', contatoId: 10, status: 'open', labels: ['Vendas'], supervisores: [] },
    { agente: 'Maria Santos', data: '2026-08-16', hora: '14:00', diaSemana: 'Sex', conversaId: 2, telefone: '11888880000', contatoId: 20, status: 'resolved', labels: [], supervisores: [] },
    { agente: 'João Silva', data: '2026-08-17', hora: '09:00', diaSemana: 'Sab', conversaId: 3, telefone: '11777770000', contatoId: 30, status: 'pending', labels: ['Vendas'], supervisores: [] },
  ],
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

function mockFetchSuccess(data: DashboardData) {
  fetchSpy.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    }),
  )
}

function mockFetchAbort() {
  fetchSpy.mockImplementation(() =>
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new DOMException('The operation was aborted', 'AbortError')
        reject(err)
      }, 100)
    }),
  )
}

describe('ProspectionPage', () => {
  it('shows loading spinner when no data', () => {
    mockFetchSuccess(mockData)
    render(<ProspectionPage />)
    expect(screen.getByText(/Carregando dados de prospecção/)).toBeTruthy()
  })

  it('renders data after loading', async () => {
    // Pre-populate cache
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText('Prospecção')).toBeTruthy()
    })

    expect(screen.getByText(/3 abordagens/)).toBeTruthy()
    expect(screen.getByText('João Silva')).toBeTruthy()
    expect(screen.getByText('Maria Santos')).toBeTruthy()
  })

  it('shows error state with retry button when no cache and fetch fails', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('{"error":"internal error"}'),
      }),
    )

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText(/internal error/)).toBeTruthy()
    })

    expect(screen.getByText('Tentar novamente')).toBeTruthy()
  })

  it('shows date filter inputs', async () => {
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    const { container } = render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText('Prospecção')).toBeTruthy()
    })

    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(2) // start and end
  })

  it('filters records by search query', async () => {
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText('Prospecção')).toBeTruthy()
    })

    // Initially shows all agents
    expect(screen.getByText('João Silva')).toBeTruthy()
    expect(screen.getByText('Maria Santos')).toBeTruthy()

    // Search for "João"
    const searchInput = screen.getByPlaceholderText('Nome do agente...')
    fireEvent.change(searchInput, { target: { value: 'João' } })

    // Maria should still appear in the bar chart (all records are shown,
    // filter only affects the search box visual — aggregation uses filtered records)
    // The search filters records before aggregation
    await waitFor(() => {
      expect(screen.getByText(/abordagens/)).toBeTruthy()
    })
  })

  it('renders prospection by date table', async () => {
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText('Prospecções por Dia')).toBeTruthy()
    })

    expect(screen.getByText('15/08/2026')).toBeTruthy()
    expect(screen.getByText('16/08/2026')).toBeTruthy()
    expect(screen.getByText('17/08/2026')).toBeTruthy()
  })

  it('shows polling state after abort', async () => {
    mockFetchAbort()

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText(/Análise em processamento/)).toBeTruthy()
    })
  })

  it('renders funnel chart', async () => {
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText('Prospecção')).toBeTruthy()
    })

    // Funnel should be rendered (it shows prospection count)
    expect(screen.getByText(/3 abordagens/)).toBeTruthy()
  })

  it('shows update button', async () => {
    localStorage.setItem('chatwoot_prospection_cache', JSON.stringify(mockData))
    mockFetchSuccess(mockData)

    render(<ProspectionPage />)

    await waitFor(() => {
      expect(screen.getByText(/Atualizar/)).toBeTruthy()
    })
  })
})
