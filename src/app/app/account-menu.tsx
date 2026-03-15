'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AccountMenuProps {
  displayName: string
  avatarUrl: string | null
  plan: string
  email: string
}

export function AccountMenu({ displayName, avatarUrl, plan, email }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-50">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{email}</p>
              </div>
            </div>
            <div className="mt-2">
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                plan === 'pro'
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                {plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>

          <div className="py-1">
            {plan === 'pro' && (
              <a
                href="/dashboard"
                className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Dashboard
              </a>
            )}
            {plan !== 'pro' && (
              <a
                href="/pricing"
                className="block px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Upgrade to Pro
              </a>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
