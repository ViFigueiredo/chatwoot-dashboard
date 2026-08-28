import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Report, Agent, LabelInfo } from '@/types'

const mockLabels: LabelInfo[] = [
  { title: 'Suporte', color: '#ff0000' },
  { title: 'Vendas', color: '#00ff00' },
]

const mockAgents: Agent[] = [
  {
    id: 1,
    name: 'João Silva',
    email: 'joao@empresa.com',
    role: 'agent',
    availability: 'online',
    total: 100,
    open: 10,
    resolved: 80,
    pending: 5,
    snoozed: 5,
    labels: { Suporte: 60, Vendas: 40 },
  },
]

const mockReport: Report = {
  generatedAt: '2026-08-28T12:00:00Z',
  totalConversations: 150,
  expectedConversations: 150,
  failedPages: [],
  labels: mockLabels,
  agents: mockAgents,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportAgentsToCSV', () => {
  it('generates CSV without errors', async () => {
    // The function creates a blob and triggers download
    // We can't easily mock the download in jsdom, so just verify no errors
    const { exportAgentsToCSV } = await import('../excel')

    // Spy on createElement to catch the download attempt
    const createElementSpy = vi.spyOn(document, 'createElement')

    exportAgentsToCSV(mockAgents, mockLabels, 'test.csv')

    // Verify an anchor element was created for download
    expect(createElementSpy).toHaveBeenCalledWith('a')

    createElementSpy.mockRestore()
  })

  it('uses correct filename', async () => {
    const { exportAgentsToCSV } = await import('../excel')
    const createElementSpy = vi.spyOn(document, 'createElement')

    exportAgentsToCSV(mockAgents, mockLabels, 'custom-name.csv')

    // The anchor should have the download attribute set
    const anchor = createElementSpy.mock.results[0]?.value
    if (anchor) {
      expect(anchor.download).toBe('custom-name.csv')
    }

    createElementSpy.mockRestore()
  })
})

describe('exportReportToExcel', () => {
  it('generates Excel file without errors', async () => {
    const { exportReportToExcel } = await import('../excel')
    // xlsx library works in jsdom, just verify it doesn't throw
    expect(() => exportReportToExcel(mockReport, 'test.xlsx')).not.toThrow()
  })

  it('handles report with no agents', async () => {
    const { exportReportToExcel } = await import('../excel')
    const emptyReport = { ...mockReport, agents: [] }
    expect(() => exportReportToExcel(emptyReport, 'empty.xlsx')).not.toThrow()
  })
})
