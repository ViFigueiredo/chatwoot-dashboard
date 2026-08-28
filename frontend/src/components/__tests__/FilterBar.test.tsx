import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterBar from '../FilterBar'
import type { FilterState, LabelInfo } from '@/types'

const mockLabels: LabelInfo[] = [
  { title: 'Suporte', color: '#ff0000' },
  { title: 'Vendas', color: '#00ff00' },
]

const defaultFilters: FilterState = {
  search: '',
  status: [],
  labels: [],
  dateRange: null,
}

describe('FilterBar', () => {
  it('renders search input', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} labels={mockLabels} />)
    expect(screen.getByPlaceholderText('Buscar agente...')).toBeInTheDocument()
  })

  it('renders status filter buttons', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} labels={mockLabels} />)
    expect(screen.getByText('Abertas')).toBeInTheDocument()
    expect(screen.getByText('Resolvidas')).toBeInTheDocument()
    expect(screen.getByText('Pendentes')).toBeInTheDocument()
    expect(screen.getByText('Adiadas')).toBeInTheDocument()
  })

  it('renders label filter buttons', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} labels={mockLabels} />)
    expect(screen.getByText('Suporte')).toBeInTheDocument()
    expect(screen.getByText('Vendas')).toBeInTheDocument()
  })

  it('calls onChange when typing in search', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} labels={mockLabels} />)

    fireEvent.input(screen.getByPlaceholderText('Buscar agente...'), {
      target: { value: 'João' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'João' })
    )
  })

  it('calls onChange when clicking status button', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} labels={mockLabels} />)

    fireEvent.click(screen.getByText('Abertas'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['open'] })
    )
  })

  it('toggles status off when clicking active button', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        filters={{ ...defaultFilters, status: ['open'] }}
        onChange={onChange}
        labels={mockLabels}
      />
    )

    fireEvent.click(screen.getByText('Abertas'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: [] })
    )
  })

  it('calls onChange when clicking label button', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} labels={mockLabels} />)

    fireEvent.click(screen.getByText('Suporte'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ['Suporte'] })
    )
  })

  it('shows clear button when filters are active', () => {
    render(
      <FilterBar
        filters={{ ...defaultFilters, search: 'test' }}
        onChange={vi.fn()}
        labels={mockLabels}
      />
    )

    expect(screen.getByText('Limpar')).toBeInTheDocument()
  })

  it('does not show clear button when no filters', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} labels={mockLabels} />)
    expect(screen.queryByText('Limpar')).not.toBeInTheDocument()
  })

  it('clears all filters when clicking clear', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        filters={{ ...defaultFilters, search: 'test', status: ['open'] }}
        onChange={onChange}
        labels={mockLabels}
      />
    )

    fireEvent.click(screen.getByText('Limpar'))

    expect(onChange).toHaveBeenCalledWith({
      search: '',
      status: [],
      labels: [],
      dateRange: null,
    })
  })
})
