export interface Agent {
  id: number
  name: string
  email: string
  role: string
  availability: string
  total: number
  open: number
  resolved: number
  pending: number
  snoozed: number
  labels: Record<string, number>
}

export interface LabelInfo {
  title: string
  color: string
}

export interface Report {
  generatedAt: string
  totalConversations: number
  expectedConversations: number
  failedPages: number[]
  labels: LabelInfo[]
  agents: Agent[]
}

export interface ProspectionRecord {
  agente: string
  data: string
  hora: string
  diaSemana: string
  conversaId: number
  telefone: string
  contatoId: number | null
  status: string
  labels: string[]
  supervisores: string[]
}

export interface DashboardData {
  generatedAt: string
  cutoffDate: string
  labels: LabelInfo[]
  teams: string[]
  agentTeams: Record<string, string[]>
  records: ProspectionRecord[]
}

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export interface FilterState {
  search: string
  status: string[]
  labels: string[]
  dateRange: { start: string; end: string } | null
}
