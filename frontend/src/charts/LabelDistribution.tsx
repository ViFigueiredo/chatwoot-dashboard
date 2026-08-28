import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Agent, LabelInfo } from '@/types'

interface Props {
  agents: Agent[]
  labels: LabelInfo[]
}

// Vibrant palette for labels — never falls back to grey
const LABEL_PALETTE = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#6366f1', // indigo
  '#84cc16', // lime
]

export default function LabelDistribution({ agents, labels }: Props) {
  // Aggregate labels across all agents
  const labelTotals: Record<string, number> = {}
  for (const agent of agents) {
    for (const [label, count] of Object.entries(agent.labels)) {
      labelTotals[label] = (labelTotals[label] || 0) + count
    }
  }

  const data = Object.entries(labelTotals)
    .map(([name, value], i) => ({
      name,
      value,
      color: getColor(name, labels, i),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-muted mb-4">Distribuição de Etiquetas</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [value.toLocaleString('pt-BR'), '']}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  )
}

function getColor(name: string, labels: LabelInfo[], index: number): string {
  // Try to find color from Chatwoot labels
  const found = labels.find((l) => l.title === name)
  if (found?.color && found.color !== '#000000' && found.color !== '#ffffff') {
    return found.color
  }
  // Fallback to vibrant palette (never grey)
  return LABEL_PALETTE[index % LABEL_PALETTE.length]
}
