import { useState } from 'react'
import { useReport } from '@/hooks/useReport'
import DataTable from '@/components/DataTable'
import FilterBar from '@/components/FilterBar'
import ExportButton from '@/components/ExportButton'
import LoadingSpinner from '@/components/LoadingSpinner'
import RefreshIndicator from '@/components/RefreshIndicator'
import type { FilterState } from '@/types'

export default function AgentsPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '', status: [], labels: [], dateRange: null,
  })

  const startDate = filters.dateRange?.start || undefined
  const endDate = filters.dateRange?.end || undefined
  const { report, loading, refreshing, error, rateLimited, refresh, lastUpdated } = useReport(startDate, endDate)

  if (loading && !report) return <LoadingSpinner />
  if (error && !report) return (
    <div className="p-8 text-center">
      <p className="text-danger-text text-lg mb-4">⚠️ {error}</p>
      <button onClick={() => refresh()} className="px-4 py-2 bg-accent text-bg rounded-lg font-medium">
        Tentar novamente
      </button>
    </div>
  )
  if (!report) return null

  const allAgents = report.agents || []
  const labels = report.labels || []

  // Apply client-side filters
  const filteredAgents = allAgents.filter((a) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false
    }
    if (filters.status.length > 0) {
      const has = filters.status.some((s) => {
        switch (s) {
          case 'open': return a.open > 0
          case 'resolved': return a.resolved > 0
          case 'pending': return a.pending > 0
          case 'snoozed': return a.snoozed > 0
          default: return false
        }
      })
      if (!has) return false
    }
    if (filters.labels.length > 0) {
      if (!filters.labels.some((l) => (a.labels[l] || 0) > 0)) return false
    }
    return true
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Agentes</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted">
              {filteredAgents.length} de {allAgents.length} agentes
            </p>
            <RefreshIndicator refreshing={refreshing} lastUpdated={lastUpdated} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton report={report} />
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="px-4 py-2.5 border border-border text-muted hover:text-text text-sm rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {refreshing ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {rateLimited && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⏳ {error || 'Limite de atualizações atingido.'}
        </div>
      )}
      {error && !rateLimited && report && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⚠️ Erro ao atualizar: {error}
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters} labels={labels} />
      <DataTable agents={filteredAgents} labels={labels} searchQuery={filters.search} />
    </div>
  )
}
