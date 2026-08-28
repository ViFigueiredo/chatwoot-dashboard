import { useState } from 'react'
import { useReport } from '@/hooks/useReport'
import LoadingSpinner from '@/components/LoadingSpinner'
import RefreshIndicator from '@/components/RefreshIndicator'
import { formatNumber } from '@/lib/formatters'
import type { FilterState } from '@/types'

export default function AnalysisPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '', status: [], labels: [], dateRange: null,
  })

  const startDate = filters.dateRange?.start || undefined
  const endDate = filters.dateRange?.end || undefined
  const { report, loading, refreshing, error, rateLimited, refresh, lastUpdated } = useReport(startDate, endDate)

  if (loading && !report) return <LoadingSpinner />
  if (error && !report) return <div className="p-8 text-center text-danger-text">{error}</div>
  if (!report) return null

  const agents = report.agents || []
  const labels = report.labels || []

  const topLabels = labels
    .map((l) => ({
      ...l,
      total: agents.reduce((sum, a) => sum + (a.labels[l.title] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)

  const topAgents = agents.slice(0, 10)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Análise</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted">
              Análise consolidada de agentes e etiquetas
              {startDate && ` · desde ${startDate}`}
              {endDate && ` até ${endDate}`}
            </p>
            <RefreshIndicator refreshing={refreshing} lastUpdated={lastUpdated} />
          </div>
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing}
          className="px-4 py-2.5 border border-border text-muted hover:text-text text-sm rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {refreshing ? '⏳' : '🔄'} Atualizar
        </button>
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

      {/* Date Range Filter */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Período:</span>
          <input
            type="date"
            value={filters.dateRange?.start || ''}
            onChange={(e) => {
              const start = e.target.value || undefined
              const end = filters.dateRange?.end
              setFilters({
                ...filters,
                dateRange: start || end ? { start: start || '', end: end || '' } : null,
              })
            }}
            className="px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-muted">até</span>
          <input
            type="date"
            value={filters.dateRange?.end || ''}
            onChange={(e) => {
              const end = e.target.value || undefined
              const start = filters.dateRange?.start
              setFilters({
                ...filters,
                dateRange: start || end ? { start: start || '', end: end || '' } : null,
              })
            }}
            className="px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3 mb-6">
        <a
          href="/api/export-analysis"
          className="px-4 py-2.5 bg-accent text-bg text-sm font-semibold rounded-lg hover:bg-accent-hover transition-colors"
        >
          📥 Baixar Análise A+B (CSV)
        </a>
        <a
          href="/api/export-agents"
          className="px-4 py-2.5 border border-border text-muted text-sm rounded-lg hover:text-text hover:bg-white/5 transition-colors"
        >
          📥 Baixar Agentes (CSV)
        </a>
      </div>

      {/* Top labels */}
      <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-muted mb-4">Etiquetas mais usadas</h3>
        <div className="space-y-3">
          {topLabels.slice(0, 10).map((l) => {
            const max = topLabels[0]?.total || 1
            const pct = max > 0 ? (l.total / max) * 100 : 0
            return (
              <div key={l.title} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-sm text-text w-32 truncate">{l.title}</span>
                <div className="flex-1 h-5 bg-bg rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center justify-end pr-2 text-xs font-bold text-bg"
                    style={{ width: `${pct}%`, backgroundColor: l.color, minWidth: l.total > 0 ? '24px' : '0' }}
                  >
                    {l.total > 0 && formatNumber(l.total)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agent ranking */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-4">Ranking de Agentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs text-muted bg-bg-header">#</th>
                <th className="text-left px-3 py-2 text-xs text-muted bg-bg-header">Agente</th>
                <th className="text-right px-3 py-2 text-xs text-muted bg-bg-header">Total</th>
                <th className="text-right px-3 py-2 text-xs text-muted bg-bg-header">Abertas</th>
                <th className="text-right px-3 py-2 text-xs text-muted bg-bg-header">Resolvidas</th>
                <th className="text-right px-3 py-2 text-xs text-muted bg-bg-header">Pendentes</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((a, i) => (
                <tr key={a.id} className="border-t border-border hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-muted">{i + 1}</td>
                  <td className="px-3 py-2"><span className="text-text font-medium">{a.name}</span></td>
                  <td className="px-3 py-2 text-right font-bold text-text">{formatNumber(a.total)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{formatNumber(a.open)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{formatNumber(a.resolved)}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{formatNumber(a.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
