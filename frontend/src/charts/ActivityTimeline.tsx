interface Props {
  data?: { date: string; count: number }[]
}

export default function ActivityTimeline({ data = [] }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-4">Linha do Tempo</h3>
        <div className="flex items-center justify-center h-[300px] text-muted text-sm">
          Dados de atividade temporal serão exibidos aqui quando disponíveis.
          <br />
          Use a Análise A+B para gerar dados históricos.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-muted mb-4">Linha do Tempo</h3>
      <div className="h-[300px] flex items-end gap-1 px-4">
        {data.map((d, i) => {
          const max = Math.max(...data.map((x) => x.count))
          const height = max > 0 ? (d.count / max) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted">{d.count}</span>
              <div
                className="w-full bg-accent rounded-t"
                style={{ height: `${height}%`, minHeight: '2px' }}
              />
              <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
