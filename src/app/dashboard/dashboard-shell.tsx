'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  History,
  LayoutDashboard,
  Menu,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type DashboardShellProps = {
  children: React.ReactNode
  plan: string
  displayName: string
  avatarUrl: string | null
  email: string
}

const RAIL_PINNED_KEY = 'dashboard-rail-pinned'

function readPinnedPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(RAIL_PINNED_KEY) === '1'
}

export function DashboardShell({ children, plan, displayName, avatarUrl, email }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pinnedOpen, setPinnedOpen] = useState(readPinnedPreference)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.localStorage.setItem(RAIL_PINNED_KEY, pinnedOpen ? '1' : '0')
  }, [pinnedOpen])

  const desktopExpanded = pinnedOpen || hoverOpen

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current) return
      if (!accountMenuRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleAccountToggle() {
    if (!desktopExpanded && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setPinnedOpen(true)
      setAccountOpen(true)
      return
    }

    setAccountOpen(prev => !prev)
  }

  const toolNavItems = useMemo(
    () => [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/tiles', label: 'Tiles', icon: BarChart3 },
      { href: '/dashboard/history', label: 'History', icon: History },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => {
            setHoverOpen(false)
            setAccountOpen(false)
          }}
          className={[
            'fixed inset-y-0 left-0 z-40 bg-surface-1 transition-all duration-300 ease-out',
            mobileOpen ? 'w-64' : (desktopExpanded ? 'w-64' : 'w-16'),
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:static lg:translate-x-0',
          ].join(' ')}
        >
          <div className="flex h-full flex-col px-2 py-3">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileOpen(prev => !prev)
                } else {
                  setPinnedOpen(prev => {
                    const next = !prev
                    if (!next) {
                      setAccountOpen(false)
                    }
                    return next
                  })
                }
              }}
              className={[
                'mb-2 flex h-10 self-start items-center rounded-md px-3 text-sm text-muted hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300',
              ].join(' ')}
              aria-label="Toggle navigation rail"
            >
              <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                <Menu size={18} />
              </span>
            </button>
            <nav>
            {toolNavItems.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'mb-1 flex h-10 items-center rounded-md px-3 text-sm',
                    active
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-muted hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300',
                  ].join(' ')}
                  title={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                    <Icon size={18} />
                  </span>
                  <span
                    className={[
                      'overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity,transform] duration-300 ease-out',
                      desktopExpanded ? 'ml-3 max-w-28 opacity-100 translate-x-0' : 'ml-0 max-w-0 opacity-0 -translate-x-1',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
            </nav>

            <div className="mt-auto pt-4">
              <div
                ref={accountMenuRef}
                data-testid="account-trigger-zone"
                className="mt-3 px-0"
              >
                <div className="relative">
                  <div
                    data-testid="account-popover"
                    className={[
                      'grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out',
                      desktopExpanded && accountOpen ? 'mb-1 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0',
                    ].join(' ')}
                  >
                    <div className="min-h-0 space-y-1 overflow-hidden">
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setAccountOpen(false)}
                        className={[
                          'flex h-9 items-center gap-2 rounded-md px-3 text-sm',
                          pathname === '/dashboard/settings'
                            ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-muted hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300',
                        ].join(' ')}
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <Settings size={16} />
                        </span>
                        <span>Account settings</span>
                      </Link>

                      <Link
                        href={plan === 'pro' ? '/dashboard/billing' : '/pricing'}
                        onClick={() => setAccountOpen(false)}
                        className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300"
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <CreditCard size={16} />
                        </span>
                        <span>{plan === 'pro' ? 'Billing' : 'Upgrade to Pro'}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false)
                          void handleSignOut()
                        }}
                        className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <LogOut size={16} />
                        </span>
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="account-trigger-button"
                    aria-expanded={desktopExpanded && accountOpen}
                    title={email}
                    onClick={handleAccountToggle}
                    className="mb-1 flex h-10 w-full items-center rounded-md px-3 text-sm text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                  >
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={28}
                        height={28}
                        className="block h-7 w-7 shrink-0 aspect-square rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      <div className="h-7 w-7 shrink-0 aspect-square rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {initials}
                      </div>
                    )}

                    <div
                      className={[
                        'min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity,transform] duration-300 ease-out',
                        desktopExpanded ? 'ml-3 max-w-28 opacity-100 translate-x-0' : 'ml-0 max-w-0 opacity-0 -translate-x-1',
                      ].join(' ')}
                    >
                      <p className="truncate text-[12px] font-medium text-foreground">{displayName}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{plan}</p>
                    </div>

                    <span
                      className={[
                        'ml-auto overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
                        desktopExpanded ? 'max-w-8 opacity-100 translate-x-0' : 'max-w-0 opacity-0 translate-x-1',
                      ].join(' ')}
                    >
                      {accountOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation rail"
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col transition-all duration-200">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-background px-4 backdrop-blur lg:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
                aria-label="Open navigation rail"
              >
                <Menu size={18} />
              </button>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Execution Dashboard</span>
            </div>
            <Link href="/" className="text-xs font-medium text-muted hover:text-foreground">
              Back to Home
            </Link>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-310">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
