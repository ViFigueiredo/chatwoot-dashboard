import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchProspection, AbortError, ApiError } from '@/lib/api'
import type { DashboardData } from '@/types'

const CACHE_KEY = 'chatwoot_prospection_cache'
const CACHE_TS_KEY = 'chatwoot_prospection_cache_ts'

interface UseProspectionReturn {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  error: string | null
  isPartial: boolean
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

function loadFromStorage(start?: string, end?: string): DashboardData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(start, end))
    if (!raw) return null
    return JSON.parse(raw) as DashboardData
  } catch {
    return null
  }
}

function saveToStorage(data: DashboardData, start?: string, end?: string) {
  try {
    localStorage.setItem(getCacheKey(start, end), JSON.stringify(data))
    localStorage.setItem(getCacheTsKey(start, end), Date.now().toString())
  } catch {}
}

function getLastUpdated(start?: string, end?: string): Date | null {
  const ts = localStorage.getItem(getCacheTsKey(start, end))
  if (!ts) return null
  return new Date(parseInt(ts, 10))
}

// Poll interval for partial results during long-running prospection
const POLL_INTERVAL = 10000 // 10 seconds (faster polling)
const MAX_POLL_ATTEMPTS = 180 // 30 min total (180 × 10s)

export function useProspection(startDate?: string, endDate?: string): UseProspectionReturn {
  const [data, setData] = useState<DashboardData | null>(() => loadFromStorage(startDate, endDate))
  const [loading, setLoading] = useState(!loadFromStorage(startDate, endDate))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPartial, setIsPartial] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => getLastUpdated(startDate, endDate))
  const mountedRef = useRef(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Start polling for results (shared between abort and 503)
  const startPolling = useCallback((startDate?: string, endDate?: string) => {
    setIsPartial(true)
    setError('Análise em processamento. Buscando resultados parciais...')

    let attempts = 0
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current || attempts >= MAX_POLL_ATTEMPTS) {
        stopPolling()
        if (mountedRef.current) {
          setError('A análise não concluiu a tempo. Tente refinar o período.')
          setRefreshing(false)
          setLoading(false)
        }
        return
      }
      attempts++

      try {
        const partial = await fetchProspection(false, startDate, endDate)
        if (!mountedRef.current) return
        if (partial && partial.records && partial.records.length > 0) {
          setData(partial)
          saveToStorage(partial, startDate, endDate)
          setLastUpdated(new Date())
          setIsPartial(true)
          setError(null)
          stopPolling()
          setRefreshing(false)
          setLoading(false)
        }
      } catch {
        // Still processing or error, keep polling
      }
    }, POLL_INTERVAL)
  }, [stopPolling])

  useEffect(() => {
    mountedRef.current = true

    const initialLoad = async () => {
      const cached = loadFromStorage(startDate, endDate)
      if (cached) {
        setData(cached)
        setLoading(false)
      }

      try {
        setRefreshing(true)
        setError(null)
        setIsPartial(false)
        const fresh = await fetchProspection(false, startDate, endDate)
        if (!mountedRef.current) return
        setData(fresh)
        saveToStorage(fresh, startDate, endDate)
        setLastUpdated(new Date())
        setError(null)
        setIsPartial(false)
      } catch (err) {
        if (!mountedRef.current) return

        if (err instanceof AbortError) {
          // Timeout — start polling
          console.warn('[useProspection] Fetch aborted, polling for partial results')
          startPolling(startDate, endDate)
        } else if (err instanceof ApiError && (err.status === 503 || err.status === 429)) {
          // Build in progress or rate limited — start polling
          console.warn(`[useProspection] ${err.status} received, polling for partial results`)
          startPolling(startDate, endDate)
        } else if (!cached) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados de prospecção')
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    initialLoad()

    return () => {
      mountedRef.current = false
      stopPolling()
    }
  }, [startDate, endDate, stopPolling, startPolling])

  const refresh = useCallback(async (start?: string, end?: string) => {
    stopPolling()
    setRefreshing(true)
    setError(null)
    setIsPartial(false)
    try {
      const fresh = await fetchProspection(true, start ?? startDate, end ?? endDate)
      if (!mountedRef.current) return
      setData(fresh)
      saveToStorage(fresh, start ?? startDate, end ?? endDate)
      setLastUpdated(new Date())
      setIsPartial(false)
    } catch (err) {
      if (!mountedRef.current) return
      if (err instanceof AbortError) {
        startPolling(start ?? startDate, end ?? endDate)
      } else if (err instanceof ApiError && (err.status === 503 || err.status === 429)) {
        startPolling(start ?? startDate, end ?? endDate)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar')
      }
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }, [startDate, endDate, stopPolling, startPolling])

  return { data, loading, refreshing, error, isPartial, refresh, lastUpdated }
}
