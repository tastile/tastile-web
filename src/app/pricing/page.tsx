'use client'

import Link from "next/link";
import { useState } from 'react'
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
      <div className="layout-shell max-w-5xl py-20">
        <div className="layout-grid-2 items-start gap-8">
          <div>
           <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
             Simple, transparent pricing
           </h1>
           <p className="mt-4 text-lg text-foreground-muted">
             Start free, upgrade when you need more power.
           </p>
          </div>
          <aside className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">Plan Selection</p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              価格比較は左から右へ読む流れに合わせる  
              フリーを基準にして Pro を右側に強調する
            </p>
          </aside>
        </div>

        <div className="layout-grid-2 mt-16 gap-8">
          {/* Free Plan */}
           <div className="rounded-xl border border-border bg-surface-elevated p-8">
             <h2 className="text-2xl font-[590] text-foreground">Free</h2>
             <p className="mt-2 text-foreground-muted">For personal execution control</p>
             <p className="mt-4 text-4xl font-[590] text-foreground">$0</p>
            
            <ul className="mt-8 space-y-4">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">100 local tiles</span>
                   <p className="text-sm text-foreground-muted">Stored on your device</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">50 cloud tiles</span>
                   <p className="text-sm text-foreground-muted">Sync across devices</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">30 day history</span>
                   <p className="text-sm text-foreground-muted">Execution tracking</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">Web app</span>
                   <p className="text-sm text-foreground-muted">Status, prompt, memo</p>
                </div>
              </li>
            </ul>

            <Link
              href="/login"
               className="mt-8 block w-full rounded-md border border-border bg-surface-1 px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-surface-2"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
           <div className="relative overflow-hidden rounded-xl border border-border bg-surface-elevated p-8">
             <div className="absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
              POPULAR
            </div>
             <h2 className="text-2xl font-[590] text-foreground">Pro</h2>
             <p className="mt-2 text-foreground-muted">For serious execution control</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setInterval('monthly')}
                 className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${interval === 'monthly' ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-foreground-subtle hover:text-foreground'}`}
              >Monthly</button>
              <button
                onClick={() => setInterval('yearly')}
                 className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${interval === 'yearly' ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-foreground-subtle hover:text-foreground'}`}
               >Yearly <span className="text-success">save 17%</span></button>
            </div>
            <div className="mt-4 flex items-baseline">
               <span className="text-4xl font-[590] text-foreground">{interval === 'monthly' ? '$5' : '$50'}</span>
               <span className="ml-2 text-foreground-muted">/{interval === 'monthly' ? 'month' : 'year'}</span>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">10,000 tiles</span>
                   <p className="text-sm text-foreground-muted">Local + cloud storage</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">2 year history</span>
                   <p className="text-sm text-foreground-muted">Long-term tracking</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">100,000 events</span>
                   <p className="text-sm text-foreground-muted">Detailed execution log</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">Desktop sync</span>
                   <p className="text-sm text-foreground-muted">Windows app integration</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">Full dashboard</span>
                   <p className="text-sm text-foreground-muted">Analytics and insights</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                   <span className="font-medium text-foreground">Condition editing</span>
                   <p className="text-sm text-foreground-muted">Advanced tile configuration</p>
                </div>
              </li>
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={isLoading}
               className="mt-8 block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
