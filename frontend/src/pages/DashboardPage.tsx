import { useState } from 'react'
import { useReport } from '@/hooks/useReport'
import StatCard from '@/components/StatCard'
import ExportButton from '@/components/ExportButton'
import LoadingSpinner from '@/components/LoadingSpinner'
import RefreshIndicator from '@/components/RefreshIndicator'
import FilterBar from '@/components/FilterBar'
import StatusOverview from '@/charts/StatusOverview'
import LabelDistribution from '@/charts/LabelDistribution'
import AgentPerformance from '@/charts/AgentPerformance'
import { formatNumber } from '@/lib/formatters'
import type { FilterState } from '@/types'

export default function DashboardPage() {
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
  const failedPages = report.failedPages || []

  // Apply client-side filters
  const agents = allAgents.filter((a) => {
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

  const totals = agents.reduce(
    (acc, a) => ({
      open: acc.open + a.open,
      resolved: acc.resolved + a.resolved,
      pending: acc.pending + a.pending,
      snoozed: acc.snoozed + a.snoozed,
    }),
    { open: 0, resolved: 0, pending: 0, snoozed: 0 }
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted">
              {formatNumber(report.totalConversations)} conversas · {agents.length} agentes
              {failedPages.length > 0 && (
                <span className="text-amber-400 ml-2">⚠ {failedPages.length} página(s) com falha</span>
              )}
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
            {refreshing ? '⏳' : '🔄'} Atualizar
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} labels={labels} />

      {rateLimited && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⏳ {error || 'Limite de atualizações atingido. Aguarde um momento.'}
        </div>
      )}
      {error && !rateLimited && report && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⚠️ Erro ao atualizar: {error}. Dados antigos sendo exibidos.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Conversas" value={formatNumber(report.totalConversations)} icon="💬" />
        <StatCard label="Abertas" value={formatNumber(totals.open)} icon="📂" color="text-blue-400" />
        <StatCard label="Resolvidas" value={formatNumber(totals.resolved)} icon="✅" color="text-green-400" />
        <StatCard label="Pendentes" value={formatNumber(totals.pending)} icon="⏳" color="text-amber-400" />
        <StatCard label="Etiquetas" value={labels.length} icon="🏷️" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StatusOverview agents={agents} />
        <LabelDistribution agents={agents} labels={labels} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AgentPerformance agents={agents} />
      </div>
    </div>
  )
}
