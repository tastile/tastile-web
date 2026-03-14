'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BillingPage() {
  const [plan, setPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [managingBilling, setManagingBilling] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadPlan()
  }, [])

  async function loadPlan() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (data) {
      setPlan(data.plan)
    }
    setLoading(false)
  }

  async function manageBilling() {
    setManagingBilling(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } finally {
      setManagingBilling(false)
    }
  }

  if (loading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Billing</h1>

      {/* Current Plan */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">{plan}</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {plan === 'pro' ? '$5/month' : 'Free forever'}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            plan === 'pro' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400'
          }`}>
            {plan === 'pro' ? 'Active' : 'Free'}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-600 dark:text-zinc-400">Tiles</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {plan === 'pro' ? 'Up to 10,000' : 'Up to 50 cloud'}
              </span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
              <div className="h-2 bg-zinc-900 dark:bg-zinc-100 rounded-full" style={{ width: '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-600 dark:text-zinc-400">History</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {plan === 'pro' ? '2 years' : '30 days'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Billing */}
      {plan === 'pro' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Billing Management</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Manage your subscription, update payment methods, or view invoices.
          </p>
          <button
            onClick={manageBilling}
            disabled={managingBilling}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {managingBilling ? 'Loading...' : 'Manage Billing'}
          </button>
        </div>
      )}

      {plan === 'free' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Upgrade</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Upgrade to Pro for more tiles, longer history, and desktop sync.
          </p>
          <a
            href="/pricing"
            className="inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  )
}
