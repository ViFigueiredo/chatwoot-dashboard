import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from '../StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Conversas" value={1500} />)
    // Value is formatted with toLocaleString - check it contains the number
    const valueEl = screen.getByText(/1500/)
    expect(valueEl).toBeInTheDocument()
    expect(screen.getByText('Total Conversas')).toBeInTheDocument()
  })

  it('renders string value', () => {
    render(<StatCard label="Status" value="Online" />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<StatCard label="Test" value={0} icon="💬" />)
    expect(screen.getByText('💬')).toBeInTheDocument()
  })

  it('does not render icon when not provided', () => {
    const { container } = render(<StatCard label="Test" value={0} />)
    expect(container.querySelector('.text-2xl')).not.toHaveTextContent('💬')
  })

  it('applies custom color class', () => {
    render(<StatCard label="Test" value={0} icon="✅" color="text-green-400" />)
    const icon = screen.getByText('✅')
    expect(icon.className).toContain('text-green-400')
  })

  it('has dark theme styling', () => {
    const { container } = render(<StatCard label="Test" value={0} />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('bg-bg-card')
    expect(card.className).toContain('border-border')
  })
})
