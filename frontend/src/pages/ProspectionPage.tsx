import { useState } from 'react'
import { useProspection } from '@/hooks/useProspection'
import ProspectionFunnel from '@/charts/ProspectionFunnel'
import LoadingSpinner from '@/components/LoadingSpinner'
import RefreshIndicator from '@/components/RefreshIndicator'
import type { FilterState } from '@/types'

function formatDateBR(iso: string): string {
  // Convert YYYY-MM-DD to DD/MM/YYYY
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export default function ProspectionPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '', status: [], labels: [], dateRange: null,
  })

  const startDate = filters.dateRange?.start || undefined
  const endDate = filters.dateRange?.end || undefined
  const { data, loading, refreshing, error, isPartial, refresh, lastUpdated } = useProspection(startDate, endDate)

  if (loading && !data) return <LoadingSpinner message="Carregando dados de prospecção..." />
  if (error && !data && !isPartial) return (
    <div className="p-8 text-center">
      <p className="text-danger-text text-lg mb-2">⚠️ {error}</p>
      <p className="text-muted text-sm mb-4">
        A análise de prospecção precisa verificar a primeira mensagem de cada conversa.
        Com muitas conversas, isso pode levar vários minutos.
      </p>
      <p className="text-muted text-sm mb-4">
        💡 Dica: Defina um período mais curto para reduzir o tempo de processamento.
      </p>
      <button onClick={() => refresh()} className="px-4 py-2 bg-accent text-bg rounded-lg font-medium">
        Tentar novamente
      </button>
    </div>
  )
  // Show polling state even without data
  if (isPartial && !data) return (
    <div className="p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-text text-lg mb-2">⏳ {error || 'Análise em processamento...'}</p>
      <p className="text-muted text-sm">
        Buscando resultados parciais a cada 10 segundos.
        Esta operação pode levar vários minutos na primeira vez.
      </p>
    </div>
  )
  if (!data) return null

  let records = data.records || []

  // Client-side date range filter
  if (startDate) {
    records = records.filter((r) => r.data >= startDate)
  }
  if (endDate) {
    records = records.filter((r) => r.data <= endDate)
  }

  // Client-side search filter
  if (filters.search) {
    const q = filters.search.toLowerCase()
    records = records.filter((r) => r.agente.toLowerCase().includes(q))
  }

  // Aggregate by agent
  const byAgent: Record<string, number> = {}
  for (const r of records) {
    byAgent[r.agente] = (byAgent[r.agente] || 0) + 1
  }
  const sortedAgents = Object.entries(byAgent).sort((a, b) => b[1] - a[1])

  // Aggregate by date
  const byDate: Record<string, number> = {}
  for (const r of records) {
    byDate[r.data] = (byDate[r.data] || 0) + 1
  }
  const sortedDates = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Prospecção</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted">
              {records.length} abordagens
              {isPartial && <span className="ml-2 text-amber-400">⚡ parcial</span>}
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

      {error && data && (
        <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-200 text-sm">
          ⚠️ {error}
        </div>
      )}

      {isPartial && !error && (
        <div className="mb-4 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg text-blue-200 text-sm">
          ℹ️ Resultados parciais sendo exibidos. A análise completa ainda está em processamento.
        </div>
      )}

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted">Buscar agente:</span>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Nome do agente..."
            className="px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent min-w-[200px]"
          />
          <span className="text-xs text-muted ml-4">Período:</span>
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

      {/* Funnel */}
      <div className="mb-6">
        <ProspectionFunnel prospection={records.length} inbound={0} />
      </div>

      {/* By Agent */}
      <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-muted mb-4">Prospecções por Agente</h3>
        <div className="space-y-2">
          {sortedAgents.map(([name, count]) => {
            const max = sortedAgents[0]?.[1] || 1
            const pct = (count / max) * 100
            return (
              <div key={name} className="flex items-center gap-3">
                <span className="text-sm text-text w-40 truncate">{name}</span>
                <div className="flex-1 h-6 bg-bg rounded overflow-hidden">
                  <div
                    className="h-full bg-accent rounded flex items-center justify-end pr-2 text-xs font-bold text-bg"
                    style={{ width: `${pct}%`, minWidth: count > 0 ? '30px' : '0' }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Date */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-4">Prospecções por Dia</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs text-muted bg-bg-header">Data</th>
                <th className="text-right px-3 py-2 text-xs text-muted bg-bg-header">Abordagens</th>
                <th className="text-left px-3 py-2 text-xs text-muted bg-bg-header">Barra</th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.map(([date, count]) => {
                const max = Math.max(...sortedDates.map((d) => d[1]))
                const pct = max > 0 ? (count / max) * 100 : 0
                return (
                  <tr key={date} className="border-t border-border hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-text">{formatDateBR(date)}</td>
                    <td className="px-3 py-2 text-right font-medium text-text">{count}</td>
                    <td className="px-3 py-2">
                      <div className="h-4 bg-bg rounded overflow-hidden">
                        <div className="h-full bg-accent/60 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
