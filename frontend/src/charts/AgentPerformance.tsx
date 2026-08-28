import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Agent } from '@/types'

interface Props {
  agents: Agent[]
  limit?: number
}

export default function AgentPerformance({ agents, limit = 10 }: Props) {
  const data = agents
    .slice(0, limit)
    .map((a) => ({
      name: a.name.length > 15 ? a.name.slice(0, 15) + '...' : a.name,
      Abertas: a.open,
      Resolvidas: a.resolved,
      Pendentes: a.pending,
    }))

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-muted mb-4">Performance por Agente</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: '12px' }} />
          <Bar dataKey="Resolvidas" fill="#22c55e" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Abertas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Pendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
