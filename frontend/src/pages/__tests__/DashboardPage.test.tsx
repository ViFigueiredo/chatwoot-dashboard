import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../DashboardPage'

// Mock the useReport hook
const mockUseReport = vi.fn()
vi.mock('@/hooks/useReport', () => ({
  useReport: () => mockUseReport(),
}))

// Mock the chart components to avoid recharts rendering issues
vi.mock('@/charts/StatusOverview', () => ({
  default: () => <div data-testid="status-overview" />,
}))
vi.mock('@/charts/LabelDistribution', () => ({
  default: () => <div data-testid="label-distribution" />,
}))
vi.mock('@/charts/AgentPerformance', () => ({
  default: () => <div data-testid="agent-performance" />,
}))

const mockReport = {
  generatedAt: '2026-08-28T12:00:00Z',
  totalConversations: 15000,
  expectedConversations: 15000,
  failedPages: [],
  labels: [
    { title: 'Suporte', color: '#ff0000' },
    { title: 'Vendas', color: '#00ff00' },
  ],
  agents: [
    {
      id: 1,
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'agent',
      availability: 'online',
      total: 100,
      open: 10,
      resolved: 80,
      pending: 5,
      snoozed: 5,
      labels: { Suporte: 60, Vendas: 40 },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardPage', () => {
  it('shows loading spinner when loading and no data', () => {
    mockUseReport.mockReturnValue({
      report: null,
      loading: true,
      refreshing: false,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    expect(screen.getByText('Carregando dados...')).toBeInTheDocument()
  })

  it('renders dashboard when data is loaded', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: false,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: new Date(),
    })

    render(<DashboardPage />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    // Value is formatted with Brazilian locale (15.000) - appears in header and stat card
    const matches = screen.getAllByText(/15[.,]?000/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows stat cards with correct values', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: false,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    // Total appears in stat card and header
    const matches = screen.getAllByText(/15[.,]?000/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('10')).toBeInTheDocument() // Open
    expect(screen.getByText('80')).toBeInTheDocument() // Resolved
    expect(screen.getByText('5')).toBeInTheDocument() // Pending
  })

  it('shows charts', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: false,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    expect(screen.getByTestId('status-overview')).toBeInTheDocument()
    expect(screen.getByTestId('label-distribution')).toBeInTheDocument()
    expect(screen.getByTestId('agent-performance')).toBeInTheDocument()
  })

  it('shows error when no data and error exists', () => {
    mockUseReport.mockReturnValue({
      report: null,
      loading: false,
      refreshing: false,
      error: 'Connection failed',
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    expect(screen.getByText(/Connection failed/)).toBeInTheDocument()
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
  })

  it('shows background error toast when data exists but refresh failed', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: false,
      error: 'Refresh failed',
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: new Date(),
    })

    render(<DashboardPage />)
    expect(screen.getByText(/Erro ao atualizar/)).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows rate limit warning when rate limited', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: false,
      error: 'Limite de atualizações atingido',
      rateLimited: true,
      refresh: vi.fn(),
      lastUpdated: new Date(),
    })

    render(<DashboardPage />)
    expect(screen.getByText(/Limite de atualizações/)).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows failed pages warning', () => {
    mockUseReport.mockReturnValue({
      report: { ...mockReport, failedPages: [1, 2, 3] },
      loading: false,
      refreshing: false,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    expect(screen.getByText(/3.*página.*falha/)).toBeInTheDocument()
  })

  it('shows refreshing indicator', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: true,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: new Date(),
    })

    render(<DashboardPage />)
    expect(screen.getByText('Atualizando...')).toBeInTheDocument()
  })

  it('shows cached data while refreshing', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: true,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: new Date(),
    })

    render(<DashboardPage />)
    // Data should still be visible while refreshing
    const matches = screen.getAllByText(/15[.,]?000/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('disables update button while refreshing', () => {
    mockUseReport.mockReturnValue({
      report: mockReport,
      loading: false,
      refreshing: true,
      error: null,
      rateLimited: false,
      refresh: vi.fn(),
      lastUpdated: null,
    })

    render(<DashboardPage />)
    // Find the button containing ⏳ and Atualizar
    const buttons = screen.getAllByRole('button')
    const updateBtn = buttons.find(b => b.textContent?.includes('Atualizar'))
    expect(updateBtn).toBeDisabled()
  })
})
