interface Props {
  prospection?: number
  inbound?: number
}

export default function ProspectionFunnel({ prospection = 0, inbound = 0 }: Props) {
  const total = prospection + inbound
  const prospPct = total > 0 ? (prospection / total) * 100 : 0
  const inbPct = total > 0 ? (inbound / total) * 100 : 0

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-muted mb-4">Prospecção vs Atendimento</h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-muted text-sm">
          Execute a exportação de prospecção para ver este gráfico.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Funnel bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Prospecção (Outbound)</span>
                <span>{prospection.toLocaleString('pt-BR')} ({prospPct.toFixed(1)}%)</span>
              </div>
              <div className="h-8 bg-bg rounded-lg overflow-hidden">
                <div
                  className="h-full bg-accent rounded-lg flex items-center justify-center text-xs font-bold text-bg transition-all"
                  style={{ width: `${prospPct}%`, minWidth: prospPct > 0 ? '40px' : '0' }}
                >
                  {prospPct > 10 && `${prospPct.toFixed(0)}%`}
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Atendimento (Inbound)</span>
                <span>{inbound.toLocaleString('pt-BR')} ({inbPct.toFixed(1)}%)</span>
              </div>
              <div className="h-8 bg-bg rounded-lg overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-lg flex items-center justify-center text-xs font-bold text-bg transition-all"
                  style={{ width: `${inbPct}%`, minWidth: inbPct > 0 ? '40px' : '0' }}
                >
                  {inbPct > 10 && `${inbPct.toFixed(0)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="text-center pt-2 border-t border-border">
            <span className="text-muted text-xs">Total: </span>
            <span className="text-text font-bold text-sm">{total.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
