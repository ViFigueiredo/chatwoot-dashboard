import { useCallback } from 'react'
import type { Report } from '@/types'
import { exportReportToExcel, exportAgentsToCSV } from '@/lib/excel'

export function useExport() {
  const downloadExcel = useCallback((report: Report, filename?: string) => {
    exportReportToExcel(report, filename)
  }, [])

  const downloadCSV = useCallback((report: Report, filename?: string) => {
    exportAgentsToCSV(report.agents, report.labels, filename)
  }, [])

  return { downloadExcel, downloadCSV }
}
