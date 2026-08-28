import { useMemo, useState } from 'react'
import type { Agent, LabelInfo } from '@/types'

interface Props {
  agents: Agent[]
  labels: LabelInfo[]
  searchQuery: string
  onRowClick?: (agent: Agent) => void
}

type SortKey = keyof Agent | 'labels'
type SortDir = 'asc' | 'desc'

export default function DataTable({ agents, labels, searchQuery, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedAgents = useMemo(() => {
    const filtered = agents.filter((a) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    })

    return [...filtered].sort((a, b) => {
      const va = a[sortKey as keyof Agent]
      const vb = b[sortKey as keyof Agent]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const na = Number(va) || 0
      const nb = Number(vb) || 0
      return sortDir === 'asc' ? na - nb : nb - na
    })
  }, [agents, searchQuery, sortKey, sortDir])

  const th = (key: SortKey, label: string) => (
    <th
      onClick={() => handleSort(key)}
      className="px-4 py-3 text-left text-xs font-semibold text-muted bg-bg-header cursor-pointer hover:text-text transition-colors"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === key && (sortDir === 'desc' ? ' ▼' : ' ▲')}
      </div>
    </th>
  )

  return (
    <div className="overflow-x-auto bg-bg-card border border-border rounded-xl">
      <table className="w-full">
        <thead>
          <tr>
            {th('name', 'Agente')}
            {th('availability', 'Status')}
            {th('total', 'Total')}
            {th('open', 'Abertas')}
            {th('pending', 'Pend.')}
            {th('resolved', 'Resolv.')}
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted bg-bg-header">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {sortedAgents.map((agent) => (
            <tr
              key={agent.id}
              onClick={() => onRowClick?.(agent)}
              className="border-b border-border hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 text-sm">
                <div className="font-medium text-text">{agent.name}</div>
                <div className="text-xs text-muted">{agent.email}</div>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                  agent.availability === 'online' ? 'bg-success text-success-text' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {agent.availability === 'online' ? 'Online' : agent.availability || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-text">{agent.total}</td>
              <td className="px-4 py-3 text-sm text-muted">{agent.open}</td>
              <td className="px-4 py-3 text-sm text-muted">{agent.pending}</td>
              <td className="px-4 py-3 text-sm text-muted">{agent.resolved}</td>
              <td className="px-4 py-3 text-sm">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(agent.labels)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([title, count]) => {
                      const LABEL_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899']
                      const foundIdx = labels.findIndex((l) => l.title === title)
                      const color = foundIdx >= 0 ? (labels[foundIdx].color || LABEL_PALETTE[foundIdx % LABEL_PALETTE.length]) : LABEL_PALETTE[Object.keys(agent.labels).indexOf(title) % LABEL_PALETTE.length]
                      return (
                        <span
                          key={title}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-bg"
                          style={{ backgroundColor: color }}
                        >
                          {title} ({count})
                        </span>
                      )
                    })}
                  {Object.values(agent.labels).every((v) => v === 0) && (
                    <span className="text-muted text-sm">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedAgents.length === 0 && (
        <div className="text-center py-12 text-muted">
          Nenhum agente encontrado com os filtros atuais.
        </div>
      )}
    </div>
  )
}
