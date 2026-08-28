import * as XLSX from 'xlsx'
import type { Agent, LabelInfo, Report } from '@/types'

export function exportReportToExcel(report: Report, filename = 'chatwoot-report.xlsx') {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Agents summary
  const agentData = report.agents.map((a) => ({
    'Agente': a.name,
    'Email': a.email,
    'Perfil': a.role,
    'Status': a.availability,
    'Total': a.total,
    'Abertas': a.open,
    'Pendentes': a.pending,
    'Resolvidas': a.resolved,
    'Adiadas': a.snoozed,
    ...Object.fromEntries(report.labels.map((l) => [l.title, a.labels[l.title] || 0])),
  }))
  const wsAgents = XLSX.utils.json_to_sheet(agentData)
  XLSX.utils.book_append_sheet(wb, wsAgents, 'Agentes')

  // Sheet 2: Label summary
  const labelSummary = report.labels.map((l) => {
    const total = report.agents.reduce((sum, a) => sum + (a.labels[l.title] || 0), 0)
    return {
      'Etiqueta': l.title,
      'Total': total,
      'Cor': l.color,
    }
  })
  const wsLabels = XLSX.utils.json_to_sheet(labelSummary)
  XLSX.utils.book_append_sheet(wb, wsLabels, 'Etiquetas')

  // Sheet 3: Status overview
  const statusData = [{
    'Total Conversas': report.totalConversations,
    'Esperadas': report.expectedConversations,
    'Páginas com Falha': report.failedPages.length,
    'Agentes Ativos': report.agents.length,
    'Total Etiquetas': report.labels.length,
    'Gerado Em': new Date(report.generatedAt).toLocaleString('pt-BR'),
  }]
  const wsStatus = XLSX.utils.json_to_sheet(statusData)
  XLSX.utils.book_append_sheet(wb, wsStatus, 'Resumo')

  XLSX.writeFile(wb, filename)
}

export function exportAgentsToCSV(agents: Agent[], labels: LabelInfo[], filename = 'dados-agentes.csv') {
  const header = ['Agente', 'Email', 'Perfil', 'Status', 'Total', 'Abertas', 'Pendentes', 'Resolvidas', 'Adiadas', ...labels.map((l) => l.title)]
  const rows = agents.map((a) => [
    a.name, a.email, a.role, a.availability,
    String(a.total), String(a.open), String(a.pending), String(a.resolved), String(a.snoozed),
    ...labels.map((l) => String(a.labels[l.title] || 0)),
  ])

  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => {
      if (cell.includes('"') || cell.includes(';') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }).join(';'))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
