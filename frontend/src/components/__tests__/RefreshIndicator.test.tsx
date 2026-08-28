import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RefreshIndicator from '../RefreshIndicator'

describe('RefreshIndicator', () => {
  it('renders nothing when not refreshing and no lastUpdated', () => {
    const { container } = render(<RefreshIndicator refreshing={false} lastUpdated={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows "Atualizando..." when refreshing', () => {
    render(<RefreshIndicator refreshing={true} lastUpdated={null} />)
    expect(screen.getByText('Atualizando...')).toBeInTheDocument()
  })

  it('shows pulse animation when refreshing', () => {
    render(<RefreshIndicator refreshing={true} lastUpdated={null} />)
    const dot = document.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })

  it('shows time ago when not refreshing', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    render(<RefreshIndicator refreshing={false} lastUpdated={fiveMinAgo} />)
    expect(screen.getByText(/há/)).toBeInTheDocument()
  })

  it('shows "agora" for very recent update', () => {
    const now = new Date()
    render(<RefreshIndicator refreshing={false} lastUpdated={now} />)
    // The text is "Atualizado agora" in one span
    expect(screen.getByText(/agora/)).toBeInTheDocument()
  })

  it('shows hours for older updates', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    render(<RefreshIndicator refreshing={false} lastUpdated={twoHoursAgo} />)
    expect(screen.getByText(/há 2h/)).toBeInTheDocument()
  })

  it('shows days for very old updates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    render(<RefreshIndicator refreshing={false} lastUpdated={threeDaysAgo} />)
    expect(screen.getByText(/há 3d/)).toBeInTheDocument()
  })
})
