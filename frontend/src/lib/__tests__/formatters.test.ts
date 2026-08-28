import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateShort,
  formatNumber,
  formatPercent,
  getLabelColor,
  getStatusColor,
  getStatusLabel,
} from '../formatters'

describe('formatDate', () => {
  it('formats ISO date to Brazilian format', () => {
    const result = formatDate('2026-08-28T12:00:00Z')
    expect(result).toContain('28')
    expect(result).toContain('08')
    expect(result).toContain('2026')
  })

  it('handles empty string', () => {
    const result = formatDate('')
    expect(result).toBeDefined()
  })
})

describe('formatDateShort', () => {
  it('formats date to short Brazilian format', () => {
    const result = formatDateShort('2026-08-28T12:00:00Z')
    expect(result).toContain('28')
    expect(result).toContain('2026')
  })
})

describe('formatNumber', () => {
  it('formats number with Brazilian locale', () => {
    expect(formatNumber(1000)).toContain('1')
    expect(formatNumber(0)).toBe('0')
  })

  it('handles large numbers', () => {
    const result = formatNumber(22350)
    expect(result).toBeDefined()
  })
})

describe('formatPercent', () => {
  it('calculates percentage correctly', () => {
    expect(formatPercent(50, 100)).toBe('50.0%')
    expect(formatPercent(1, 3)).toContain('33.3%')
  })

  it('handles zero total', () => {
    expect(formatPercent(5, 0)).toBe('0%')
  })

  it('handles 100%', () => {
    expect(formatPercent(100, 100)).toBe('100.0%')
  })
})

describe('getLabelColor', () => {
  const labels = [
    { title: 'Suporte', color: '#ff0000' },
    { title: 'Vendas', color: '#00ff00' },
  ]

  it('returns color for existing label', () => {
    expect(getLabelColor('Suporte', labels)).toBe('#ff0000')
    expect(getLabelColor('Vendas', labels)).toBe('#00ff00')
  })

  it('returns vibrant palette color for unknown label', () => {
    const color = getLabelColor('Unknown', labels)
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(color).not.toBe('#64748b')
  })

  it('returns vibrant palette color for empty labels array', () => {
    const color = getLabelColor('Suporte', [])
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(color).not.toBe('#64748b')
  })
})

describe('getStatusColor', () => {
  it('returns success color for online', () => {
    expect(getStatusColor('online')).toContain('bg-success')
  })

  it('returns default color for offline', () => {
    expect(getStatusColor('offline')).toContain('bg-zinc')
  })

  it('returns default color for unknown status', () => {
    expect(getStatusColor('busy')).toContain('bg-zinc')
  })
})

describe('getStatusLabel', () => {
  it('returns Portuguese labels', () => {
    expect(getStatusLabel('online')).toBe('Online')
    expect(getStatusLabel('offline')).toBe('Offline')
    expect(getStatusLabel('busy')).toBe('Ocupado')
  })

  it('returns dash for empty string', () => {
    expect(getStatusLabel('')).toBe('-')
  })

  it('returns raw value for unknown status', () => {
    expect(getStatusLabel('away')).toBe('away')
  })
})
