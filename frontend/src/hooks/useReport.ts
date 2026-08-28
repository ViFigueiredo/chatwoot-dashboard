import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchReport, refreshReport, RateLimitError } from '@/lib/api'
import type { Report } from '@/types'

const CACHE_KEY = 'chatwoot_report_cache'
const CACHE_TS_KEY = 'chatwoot_report_cache_ts'

interface UseReportReturn {
  report: Report | null
  loading: boolean
  refreshing: boolean
  error: string | null
  rateLimited: boolean
  refresh: (startDate?: string, endDate?: string) => Promise<void>
  lastUpdated: Date | null
}

function getCacheKey(start?: string, end?: string): string {
  if (start || end) return `${CACHE_KEY}_${start || ''}_${end || ''}`
  return CACHE_KEY
}

function getCacheTsKey(start?: string, end?: string): string {
  if (start || end) return `${CACHE_TS_KEY}_${start || ''}_${end || ''}`
  return CACHE_TS_KEY
}

function loadFromStorage(start?: string, end?: string): Report | null {
  try {
    const raw = localStorage.getItem(getCacheKey(start, end))
    if (!raw) return null
    return JSON.parse(raw) as Report
  } catch {
    return null
  }
}

function saveToStorage(report: Report, start?: string, end?: string) {
  try {
    localStorage.setItem(getCacheKey(start, end), JSON.stringify(report))
    localStorage.setItem(getCacheTsKey(start, end), Date.now().toString())
  } catch {}
}

function getLastUpdated(start?: string, end?: string): Date | null {
  const ts = localStorage.getItem(getCacheTsKey(start, end))
  if (!ts) return null
  return new Date(parseInt(ts, 10))
}

function normalizeReport(data: Partial<Report>): Report {
  return {
    generatedAt: data.generatedAt || new Date().toISOString(),
    totalConversations: data.totalConversations || 0,
    expectedConversations: data.expectedConversations || 0,
    failedPages: data.failedPages || [],
    labels: data.labels || [],
    agents: data.agents || [],
  }
}

export function useReport(startDate?: string, endDate?: string): UseReportReturn {
  const [report, setReport] = useState<Report | null>(() => loadFromStorage(startDate, endDate))
  const [loading, setLoading] = useState(!loadFromStorage(startDate, endDate))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => getLastUpdated(startDate, endDate))
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const initialLoad = async () => {
      const cached = loadFromStorage(startDate, endDate)
      if (cached) {
        setReport(cached)
        setLoading(false)
      }

      try {
        setRefreshing(true)
        const fresh = await fetchReport(false, startDate, endDate)
        if (!mountedRef.current) return
        const normalized = normalizeReport(fresh)
        setReport(normalized)
        saveToStorage(normalized, startDate, endDate)
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        if (!mountedRef.current) return
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    initialLoad()
    return () => { mountedRef.current = false }
  }, [startDate, endDate])

  const refresh = useCallback(async (start?: string, end?: string) => {
    setRefreshing(true)
    setError(null)
    setRateLimited(false)
    try {
      // Use the rate-limited refresh endpoint
      const fresh = await refreshReport()
      if (!mountedRef.current) return
      const normalized = normalizeReport(fresh)
      setReport(normalized)
      saveToStorage(normalized, start ?? startDate, end ?? endDate)
      setLastUpdated(new Date())
    } catch (err) {
      if (!mountedRef.current) return
      if (err instanceof RateLimitError) {
        setRateLimited(true)
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar dados')
      }
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }, [startDate, endDate])

  return { report, loading, refreshing, error, rateLimited, refresh, lastUpdated }
}
