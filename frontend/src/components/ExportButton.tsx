import { useState } from 'react'
import type { Report } from '@/types'
import { exportReportToExcel, exportAgentsToCSV } from '@/lib/excel'

interface Props {
  report: Report
}

export default function ExportButton({ report }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-bg font-semibold text-sm rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Exportar
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-bg-card border border-border rounded-xl shadow-xl z-50 py-1">
            <button
              onClick={() => {
                exportReportToExcel(report)
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text hover:bg-white/5 transition-colors"
            >
              <span className="text-green-400">📊</span>
              Planilha Excel (.xlsx)
            </button>
            <button
              onClick={() => {
                exportAgentsToCSV(report.agents, report.labels)
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text hover:bg-white/5 transition-colors"
            >
              <span className="text-blue-400">📄</span>
              CSV Agentes (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
