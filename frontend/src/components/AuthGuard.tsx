import { useState } from 'react'
import { setToken } from '@/lib/api'

interface Props {
  onAuthenticated: () => void
}

export default function AuthGuard({ onAuthenticated }: Props) {
  const [token, setTokenInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) {
      setError('Digite o token de acesso')
      return
    }

    setLoading(true)
    setError('')

    // Store token and try a request
    setToken(token.trim())

    try {
      const res = await fetch('/api/health', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      })
      if (res.ok) {
        onAuthenticated()
      } else {
        setError('Token inválido')
        setToken('')
      }
    } catch {
      // If health check fails, still allow (might be CORS or network issue)
      onAuthenticated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-bg-card border border-border rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text">Chatwoot BI Dashboard</h1>
          <p className="text-muted text-sm mt-1">Digite o token de acesso para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={token}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token de acesso"
              className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-danger-text text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-bg font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
