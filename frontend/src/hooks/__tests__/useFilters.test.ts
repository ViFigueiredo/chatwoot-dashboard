import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from '../useFilters'
import type { Agent } from '@/types'

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
    total: 50,
    open: 0,
    resolved: 45,
    pending: 5,
    snoozed: 0,
    labels: { Suporte: 50, Vendas: 0 },
  },
  {
    id: 3,
    name: 'Pedro Costa',
    email: 'pedro@empresa.com',
    role: 'agent',
    availability: 'online',
    total: 30,
    open: 30,
    resolved: 0,
    pending: 0,
    snoozed: 0,
    labels: { Suporte: 0, Vendas: 30 },
  },
]

describe('useFilters', () => {
  it('returns all agents initially', () => {
    const { result } = renderHook(() => useFilters(mockAgents))
    expect(result.current.filteredAgents).toHaveLength(3)
  })

  it('filters by search query (name)', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'João' })
    })

    expect(result.current.filteredAgents).toHaveLength(1)
    expect(result.current.filteredAgents[0].name).toBe('João Silva')
  })

  it('filters by search query (email)', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'maria' })
    })

    expect(result.current.filteredAgents).toHaveLength(1)
    expect(result.current.filteredAgents[0].name).toBe('Maria Santos')
  })

  it('filters by status (open)', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, status: ['open'] })
    })

    // João has open=10, Pedro has open=30
    expect(result.current.filteredAgents).toHaveLength(2)
    expect(result.current.filteredAgents.map(a => a.name)).toContain('João Silva')
    expect(result.current.filteredAgents.map(a => a.name)).toContain('Pedro Costa')
  })

  it('filters by status (resolved)', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, status: ['resolved'] })
    })

    // João has resolved=80, Maria has resolved=45
    expect(result.current.filteredAgents).toHaveLength(2)
  })

  it('filters by label', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, labels: ['Vendas'] })
    })

    // João has Vendas=40, Pedro has Vendas=30
    expect(result.current.filteredAgents).toHaveLength(2)
  })

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        search: 'João',
        status: ['open'],
      })
    })

    // João has open=10 and matches search
    expect(result.current.filteredAgents).toHaveLength(1)
    expect(result.current.filteredAgents[0].name).toBe('João Silva')
  })

  it('returns empty when no match', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'Inexistente' })
    })

    expect(result.current.filteredAgents).toHaveLength(0)
  })

  it('clears filters', () => {
    const { result } = renderHook(() => useFilters(mockAgents))

    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'João' })
    })
    expect(result.current.filteredAgents).toHaveLength(1)

    act(() => {
      result.current.setFilters({ search: '', status: [], labels: [], dateRange: null })
    })
    expect(result.current.filteredAgents).toHaveLength(3)
  })
})
