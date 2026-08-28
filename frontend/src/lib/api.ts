const API_BASE = (import.meta as any).env?.VITE_API_URL || ''

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class AbortError extends Error {
  constructor(message = 'A operação excedeu o tempo limite') {
    super(message)
    this.name = 'AbortError'
  }
}

export class RateLimitError extends Error {
  remaining: number
  constructor(message: string, remaining: number) {
    super(message)
    this.name = 'RateLimitError'
    this.remaining = remaining
  }
}

function getToken(): string {
  return localStorage.getItem('dashboard_token') || ''
}

export function setToken(token: string) {
  localStorage.setItem('dashboard_token', token)
}

export function clearToken() {
  localStorage.removeItem('dashboard_token')
}

export function hasToken(): boolean {
  return !!getToken()
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 900000): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (res.status === 401) {
      clearToken()
      throw new ApiError('Token inválido ou expirado', 401)
    }

    if (res.status === 429) {
      const body = await res.text()
      let remaining = 0
      try {
        const json = JSON.parse(body)
        remaining = json.remaining || 0
        throw new RateLimitError(json.error || 'Limite de atualizações atingido', remaining)
      } catch {
        throw new RateLimitError('Limite de atualizações atingido. Aguarde um momento.', 0)
      }
    }

    if (!res.ok) {
      const body = await res.text()
      let msg = `Erro ${res.status}`
      try {
        const json = JSON.parse(body)
        msg = json.error || msg
      } catch {}
      throw new ApiError(msg, res.status)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof RateLimitError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AbortError('A análise de prospecção está demorando mais que o esperado. Tente refinar o período ou aguarde a atualização do cache.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchReport(refresh = false, startDate?: string, endDate?: string): Promise<import('@/types').Report> {
  const params = new URLSearchParams()
  if (refresh) params.set('refresh', '1')
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)
  const qs = params.toString()
  return request(`/api/report${qs ? '?' + qs : ''}`)
}

export async function fetchProspection(refresh = false, startDate?: string, endDate?: string): Promise<import('@/types').DashboardData> {
  const params = new URLSearchParams()
  if (refresh) params.set('refresh', '1')
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)
  const qs = params.toString()
  return request(`/api/prospection${qs ? '?' + qs : ''}`, {}, 1500000) // 25min timeout (matches backend deadline)
}

export async function refreshReport(): Promise<import('@/types').Report> {
  return request('/api/report-refresh')
}

export function getExportUrl(type: string, startDate?: string, endDate?: string): string {
  const token = getToken()
  const base = API_BASE || ''
  const url = new URL(`/api/${type}`, base || window.location.origin)
  if (token) url.searchParams.set('token', token)
  if (startDate) url.searchParams.set('start', startDate)
  if (endDate) url.searchParams.set('end', endDate)
  return url.toString()
}

export { ApiError }
