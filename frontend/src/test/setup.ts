import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock fetch globally
const mockFetch = vi.fn()
Object.defineProperty(window, 'fetch', { value: mockFetch })

// Reset mocks before each test
beforeEach(() => {
  localStorage.clear()
  mockFetch.mockReset()
})
