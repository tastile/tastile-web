'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BillingPage() {
  const [plan, setPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [managingBilling, setManagingBilling] = useState(false)
  const [supabase] = useState(() => createClient())

  const loadPlan = useEffectEvent(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (data) {
      setPlan(data.plan)
    }
    setLoading(false)
  })

  useEffect(() => {
    void loadPlan()
  }, [])

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
    return <p className="text-foreground-muted">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[590] text-foreground">Billing</h1>

      {/* Current Plan */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-[590] capitalize text-foreground">{plan}</p>
            <p className="text-foreground-muted">
              {plan === 'pro' ? '$5/month' : 'Free forever'}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            plan === 'pro' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
               : 'bg-surface-2 text-foreground-muted'
          }`}>
            {plan === 'pro' ? 'Active' : 'Free'}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground-muted">Tiles</span>
              <span className="text-foreground">
                {plan === 'pro' ? 'Up to 10,000' : 'Up to 50 cloud'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-primary" style={{ width: '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground-muted">History</span>
              <span className="text-foreground">
                {plan === 'pro' ? '2 years' : '30 days'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Billing */}
      {plan === 'pro' && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6">
          <h2 className="mb-4 text-lg font-[590] text-foreground">Billing Management</h2>
          <p className="mb-4 text-foreground-muted">
            Manage your subscription, update payment methods, or view invoices.
          </p>
          <button
            onClick={manageBilling}
            disabled={managingBilling}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
          >
            {managingBilling ? 'Loading...' : 'Manage Billing'}
          </button>
        </div>
      )}

      {plan === 'free' && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6">
          <h2 className="mb-4 text-lg font-[590] text-foreground">Upgrade</h2>
          <p className="mb-4 text-foreground-muted">
            Upgrade to Pro for more tiles, longer history, and desktop sync.
          </p>
          <a
            href="/pricing"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  )
}
