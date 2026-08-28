import type { FilterState, LabelInfo } from '@/types'

interface Props {
  filters: FilterState
  onChange: (filters: FilterState) => void
  labels: LabelInfo[]
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abertas' },
  { value: 'resolved', label: 'Resolvidas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'snoozed', label: 'Adiadas' },
]

export default function FilterBar({ filters, onChange, labels }: Props) {
  const toggleStatus = (status: string) => {
    const current = filters.status
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onChange({ ...filters, status: next })
  }

  const toggleLabel = (label: string) => {
    const current = filters.labels
    const next = current.includes(label)
      ? current.filter((l) => l !== label)
      : [...current, label]
    onChange({ ...filters, labels: next })
  }

  const clearAll = () => {
    onChange({ search: '', status: [], labels: [], dateRange: null })
  }

  const hasFilters = filters.search || filters.status.length > 0 || filters.labels.length > 0 || filters.dateRange

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
      {/* Row 1: Search + Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar agente..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-lg text-text placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Período:</span>
          <input
            type="date"
            value={filters.dateRange?.start || ''}
            onChange={(e) => {
              const start = e.target.value || undefined
              const end = filters.dateRange?.end
              onChange({
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
              onChange({
                ...filters,
                dateRange: start || end ? { start: start || '', end: end || '' } : null,
              })
            }}
            className="px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="px-3 py-2.5 text-sm text-muted hover:text-text border border-border rounded-lg hover:bg-white/5 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Row 2: Status filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted self-center mr-1">Status:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleStatus(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filters.status.includes(opt.value)
                ? 'bg-accent text-bg'
                : 'bg-bg border border-border text-muted hover:text-text hover:border-accent/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Row 3: Label filters */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted self-center mr-1">Etiquetas:</span>
          {labels.map((l) => (
            <button
              key={l.title}
              onClick={() => toggleLabel(l.title)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filters.labels.includes(l.title)
                  ? 'text-bg'
                  : 'bg-bg border border-border text-muted hover:text-text'
              }`}
              style={filters.labels.includes(l.title) ? { backgroundColor: l.color } : {}}
            >
              {l.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
