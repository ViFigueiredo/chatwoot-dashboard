import { useState, useMemo } from 'react'
import type { FilterState, Agent } from '@/types'

const initialFilters: FilterState = {
  search: '',
  status: [],
  labels: [],
  dateRange: null,
}

export function useFilters(agents: Agent[]) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search filter
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!agent.name.toLowerCase().includes(q) && !agent.email.toLowerCase().includes(q)) {
          return false
        }
      }

      // Status filter (agent must have conversations in selected statuses)
      if (filters.status.length > 0) {
        const hasMatchingStatus = filters.status.some((status) => {
          switch (status) {
            case 'open': return agent.open > 0
            case 'resolved': return agent.resolved > 0
            case 'pending': return agent.pending > 0
            case 'snoozed': return agent.snoozed > 0
            default: return false
          }
        })
        if (!hasMatchingStatus) return false
      }

      // Label filter (agent must have conversations with selected labels)
      if (filters.labels.length > 0) {
        const hasMatchingLabel = filters.labels.some((label) => (agent.labels[label] || 0) > 0)
        if (!hasMatchingLabel) return false
      }

      return true
    })
  }, [agents, filters])

  return { filters, setFilters, filteredAgents }
}
