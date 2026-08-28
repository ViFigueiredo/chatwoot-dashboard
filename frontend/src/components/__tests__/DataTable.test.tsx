import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DataTable from '../DataTable'
import type { Agent, LabelInfo } from '@/types'

const mockLabels: LabelInfo[] = [
  { title: 'Suporte', color: '#ff0000' },
  { title: 'Vendas', color: '#00ff00' },
]

const mockAgents: Agent[] = [
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
  {
    id: 2,
    name: 'Maria Santos',
    email: 'maria@empresa.com',
    role: 'agent',
    availability: 'offline',
    total: 200,
    open: 5,
    resolved: 190,
    pending: 3,
    snoozed: 2,
    labels: { Suporte: 150, Vendas: 50 },
  },
]

describe('DataTable', () => {
  it('renders all agents', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
  })

  it('renders agent emails', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    expect(screen.getByText('joao@empresa.com')).toBeInTheDocument()
    expect(screen.getByText('maria@empresa.com')).toBeInTheDocument()
  })

  it('renders labels for agents', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    // Use getAllByText since Suporte appears multiple times (once per agent)
    const suporteLabels = screen.getAllByText(/Suporte/)
    expect(suporteLabels.length).toBeGreaterThanOrEqual(2)
    const vendasLabels = screen.getAllByText(/Vendas/)
    expect(vendasLabels.length).toBeGreaterThanOrEqual(2)
  })

  it('shows online status badge', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    const onlineBadges = screen.getAllByText('Online')
    expect(onlineBadges.length).toBeGreaterThan(0)
  })

  it('shows offline status badge', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('sorts by total descending by default', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    const rows = screen.getAllByRole('row')
    // First data row should be Maria (200) since default sort is total desc
    expect(rows[1]).toHaveTextContent('Maria Santos')
    expect(rows[2]).toHaveTextContent('João Silva')
  })

  it('changes sort indicator when clicking name header', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" />)
    // Default sort: total desc (has arrow)
    expect(screen.getByText(/Total/)).toHaveTextContent(/▼/)
    // Click name header
    fireEvent.click(screen.getByText('Agente'))
    // Now name should have sort indicator
    expect(screen.getByText(/Agente/)).toHaveTextContent(/▼/)
  })

  it('filters by search query', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="Maria" />)
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.queryByText('João Silva')).not.toBeInTheDocument()
  })

  it('shows empty message when no agents match', () => {
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="Inexistente" />)
    expect(screen.getByText(/Nenhum agente encontrado/)).toBeInTheDocument()
  })

  it('calls onRowClick when clicking a row', () => {
    const onRowClick = vi.fn()
    render(<DataTable agents={mockAgents} labels={mockLabels} searchQuery="" onRowClick={onRowClick} />)

    fireEvent.click(screen.getByText('João Silva').closest('tr')!)
    expect(onRowClick).toHaveBeenCalledWith(mockAgents[0])
  })

  it('renders with empty agents array', () => {
    render(<DataTable agents={[]} labels={mockLabels} searchQuery="" />)
    expect(screen.getByText(/Nenhum agente encontrado/)).toBeInTheDocument()
  })

  it('displays dash for agents with no labels', () => {
    const agentsNoLabels: Agent[] = [{
      ...mockAgents[0],
      labels: {},
    }]
    render(<DataTable agents={agentsNoLabels} labels={mockLabels} searchQuery="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
