'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setDisplayName(data.display_name || '')
    }
    setLoading(false)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)

    setSaving(false)
  }

  if (loading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>

      {/* Profile */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Plan Info */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">{profile?.plan || 'Free'}</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {profile?.plan === 'pro' ? '$5/month subscription' : 'Free tier'}
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Manage Billing
          </Link>
        </div>
        
        <div className="mt-6 space-y-3">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Tiles</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {profile?.plan === 'pro' ? '10,000 limit' : '50 limit'}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">History</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {profile?.plan === 'pro' ? '2 years' : '30 days'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Sync</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-zinc-900 dark:text-zinc-100">Cloud sync enabled</span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Your tiles are automatically synced across all your devices.
        </p>
      </div>
    </div>
  )
}
