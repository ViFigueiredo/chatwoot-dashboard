interface Props {
  refreshing: boolean
  lastUpdated: Date | null
}

export default function RefreshIndicator({ refreshing, lastUpdated }: Props) {
  if (!refreshing && !lastUpdated) return null

  const timeAgo = lastUpdated ? getTimeAgo(lastUpdated) : null

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      {refreshing && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span>Atualizando...</span>
        </div>
      )}
      {!refreshing && timeAgo && (
        <span>Atualizado {timeAgo}</span>
      )}
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `há ${diffDays}d`
}
