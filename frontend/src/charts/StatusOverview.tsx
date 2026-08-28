import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Agent } from '@/types'

interface Props {
  agents: Agent[]
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  resolved: '#22c55e',
  pending: '#f59e0b',
  snoozed: '#a855f7',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Abertas',
  resolved: 'Resolvidas',
  pending: 'Pendentes',
  snoozed: 'Adiadas',
}

export default function StatusOverview({ agents }: Props) {
  const totals = agents.reduce(
    (acc, a) => ({
      open: acc.open + a.open,
      resolved: acc.resolved + a.resolved,
      pending: acc.pending + a.pending,
      snoozed: acc.snoozed + a.snoozed,
    }),
    { open: 0, resolved: 0, pending: 0, snoozed: 0 }
  )

  const data = Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      color: STATUS_COLORS[key] || '#6366f1',
    }))

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-muted mb-4">Status das Conversas</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 500 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Conversas']}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value.toLocaleString('pt-BR')}
          </div>
        ))}
      </div>
    </div>
  )
}
