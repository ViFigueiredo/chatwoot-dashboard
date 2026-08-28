interface Props {
  label: string
  value: number | string
  icon?: string
  color?: string
}

export default function StatCard({ label, value, icon, color = 'text-accent' }: Props) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-text">{value}</p>
          <p className="text-sm text-muted mt-1">{label}</p>
        </div>
        {icon && (
          <span className={`text-2xl ${color}`}>{icon}</span>
        )}
      </div>
    </div>
  )
}
