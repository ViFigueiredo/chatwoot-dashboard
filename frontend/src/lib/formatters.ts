export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return ((value / total) * 100).toFixed(1) + '%'
}

// Vibrant palette — never grey
const LABEL_PALETTE = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#8b5cf6', '#6366f1', '#84cc16',
]

export function getLabelColor(title: string, labels: { title: string; color: string }[], index?: number): string {
  const found = labels.find((l) => l.title === title)
  if (found?.color && found.color !== '#000000' && found.color !== '#ffffff') {
    return found.color
  }
  return LABEL_PALETTE[(index ?? 0) % LABEL_PALETTE.length]
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'bg-success text-success-text'
    case 'offline': return 'bg-zinc-700 text-zinc-300'
    default: return 'bg-zinc-700 text-zinc-300'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'online': return 'Online'
    case 'offline': return 'Offline'
    case 'busy': return 'Ocupado'
    default: return status || '-'
  }
}
