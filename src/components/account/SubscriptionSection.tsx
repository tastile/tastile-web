'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BUTTON_STYLES } from '@/lib/styles/button-styles'

type Plan = 'free' | 'pro'

interface Profile {
  plan: Plan
}

export function SubscriptionSection() {
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Failed to fetch profile:', error)
      } else if (data) {
        setPlan((data as Profile).plan)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [supabase])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-secondary animate-pulse rounded" />
        <div className="p-6 bg-surface-secondary rounded-lg border border-border">
          <div className="h-6 w-32 bg-surface-tertiary animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-surface-tertiary animate-pulse rounded" />
        </div>
      </div>
    )
  }

  const isPro = plan === 'pro'

  const features = {
    free: [
      'Up to 10 active tiles',
      'Basic execution control',
      'Web dashboard access',
      'Manual tile management'
    ],
    pro: [
      'Unlimited tiles',
      'Advanced automation',
      'Windows desktop client',
      'AI-powered suggestions',
      'Priority support',
      'Custom integrations'
    ]
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-surface-secondary rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
            <p className="text-sm text-foreground-tertiary mt-1">
              {isPro ? 'You have access to all Pro features' : 'Upgrade to unlock advanced features'}
            </p>
          </div>
          <span className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-full ${
            isPro
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              : 'bg-surface-tertiary text-foreground-secondary'
          }`}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>

        <div className="flex gap-3">
          {isPro ? (
            <a
              href="/api/stripe/portal"
              className={BUTTON_STYLES.secondary}
            >
              Manage Billing
            </a>
          ) : (
            <a
              href="/api/stripe/checkout"
              className={BUTTON_STYLES.primary}
            >
              Upgrade to Pro
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="p-6 bg-surface-secondary rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">Free</h4>
            {!isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Current
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">$0<span className="text-sm font-normal text-foreground-tertiary">/month</span></p>
          <ul className="space-y-2">
            {features.free.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Plan */}
        <div className="p-6 bg-surface-secondary rounded-lg border-2 border-indigo-500/50">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">Pro</h4>
            {isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Current
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">$9<span className="text-sm font-normal text-foreground-tertiary">/month</span></p>
          <ul className="space-y-2">
            {features.pro.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="mt-4">
              <a
                href="/api/stripe/checkout"
                className={`${BUTTON_STYLES.primary} w-full block text-center`}
              >
                Upgrade Now
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
