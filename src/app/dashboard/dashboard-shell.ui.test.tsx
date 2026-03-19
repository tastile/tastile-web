/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardShell } from './dashboard-shell'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

const localStorageStore = new Map<string, string>()

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore.set(key, value)
    },
    removeItem: (key: string) => {
      localStorageStore.delete(key)
    },
    clear: () => {
      localStorageStore.clear()
    },
  },
  configurable: true,
})

const { mockPush, mockSignOut } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

describe('DashboardShell UI behavior', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockSignOut.mockClear()
    window.localStorage.clear()
    window.localStorage.setItem('dashboard-rail-pinned', '0')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on click and closes on outside click', () => {
    render(
      <DashboardShell
        plan="free"
        displayName="Test User"
        avatarUrl={null}
        email="test@example.com"
      >
        <div>content</div>
      </DashboardShell>
    )

    const rail = screen.getByRole('complementary')
    const trigger = screen.getByTestId('account-trigger-button')
    const popover = screen.getByTestId('account-popover')

    fireEvent.mouseEnter(rail)
    fireEvent.click(trigger)
    expect(popover.className.includes('grid-rows-[1fr]')).toBe(true)
    expect(screen.getByRole('link', { name: 'Account settings' })).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(popover.className.includes('grid-rows-[0fr]')).toBe(true)
  })

  it('signs out and redirects to login from account menu', async () => {
    render(
      <DashboardShell
        plan="pro"
        displayName="Test User"
        avatarUrl={null}
        email="test@example.com"
      >
        <div>content</div>
      </DashboardShell>
    )

    const rail = screen.getByRole('complementary')
    const trigger = screen.getByTestId('account-trigger-button')

    fireEvent.mouseEnter(rail)
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
