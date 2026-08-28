import { useState } from 'react'
import { useReport } from '@/hooks/useReport'
import LoadingSpinner from '@/components/LoadingSpinner'
import RefreshIndicator from '@/components/RefreshIndicator'
import { formatNumber, getLabelColor } from '@/lib/formatters'
import type { FilterState } from '@/types'

export default function IndividualPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
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
  const agent = agents.find((a) => a.id === selectedId) || agents[0]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Consultor</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted">Painel individual do agente</p>
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

      {rateLimited && error && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⏳ {error}
        </div>
      )}

      {/* Agent selector + Date range */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={agent?.id || ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="px-4 py-2.5 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent min-w-[250px]"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

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

      {agent && (
        <>
          {/* Agent info */}
          <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-2xl font-bold text-accent">
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">{agent.name}</h2>
                <p className="text-sm text-muted">{agent.email}</p>
                <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  agent.availability === 'online' ? 'bg-success text-success-text' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {agent.availability || '-'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-bg rounded-lg">
                <p className="text-2xl font-bold text-text">{formatNumber(agent.total)}</p>
                <p className="text-xs text-muted">Total</p>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{formatNumber(agent.open)}</p>
                <p className="text-xs text-muted">Abertas</p>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg">
                <p className="text-2xl font-bold text-green-400">{formatNumber(agent.resolved)}</p>
                <p className="text-xs text-muted">Resolvidas</p>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg">
                <p className="text-2xl font-bold text-amber-400">{formatNumber(agent.pending)}</p>
                <p className="text-xs text-muted">Pendentes</p>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg">
                <p className="text-2xl font-bold text-purple-400">{formatNumber(agent.snoozed)}</p>
                <p className="text-xs text-muted">Adiadas</p>
              </div>
            </div>
          </div>

          {/* Labels breakdown */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-muted mb-4">Etiquetas</h3>
            <div className="space-y-3">
              {Object.entries(agent.labels)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([title, count]) => {
                  const max = Math.max(...Object.values(agent.labels))
                  const pct = max > 0 ? (count / max) * 100 : 0
                  const color = getLabelColor(title, report.labels)
                  return (
                    <div key={title} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-text w-40 truncate">{title}</span>
                      <div className="flex-1 h-5 bg-bg rounded overflow-hidden">
                        <div
                          className="h-full rounded flex items-center justify-end pr-2 text-xs font-bold text-bg"
                          style={{ width: `${pct}%`, backgroundColor: color, minWidth: count > 0 ? '24px' : '0' }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  )
                })}
              {Object.values(agent.labels).every((v) => v === 0) && (
                <p className="text-muted text-sm">Nenhuma etiqueta registrada.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
