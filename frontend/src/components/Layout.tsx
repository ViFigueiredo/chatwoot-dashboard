import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { clearToken } from '@/lib/api'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/agentes', label: 'Agentes', icon: '👥' },
  { to: '/prospeccao', label: 'Prospecção', icon: '🎯' },
  { to: '/analise', label: 'Análise', icon: '📈' },
  { to: '/consultor', label: 'Consultor', icon: '👤' },
]

export default function Layout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    clearToken()
    window.location.reload()
  }

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`h-full bg-bg-card border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className={`border-b border-border flex items-center ${collapsed ? 'p-3 justify-center' : 'p-5 justify-between'}`}>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-text flex items-center gap-2">
                <span className="text-accent">●</span>
                Chatwoot BI
              </h1>
              <p className="text-xs text-muted mt-1">Dashboard de Inteligência</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg text-sm transition-all duration-200 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted hover:text-text hover:bg-white/5'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${collapsed ? 'text-xl' : 'text-base'}`}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className={`p-2 border-t border-border ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair' : undefined}
            className={`flex items-center gap-3 rounded-lg text-sm text-muted hover:text-danger-text hover:bg-danger/10 transition-colors ${
              collapsed ? 'justify-center px-2 py-2.5 w-auto' : 'w-full px-3 py-2.5'
            }`}
          >
            <span className={`flex-shrink-0 ${collapsed ? 'text-xl' : 'text-base'}`}>🚪</span>
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content — scrollable, fills remaining height */}
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
