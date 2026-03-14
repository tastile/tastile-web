'use client'

import Link from "next/link";
import { useState } from 'react'

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Start free, upgrade when you need more power.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Free</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">For personal execution control</p>
            <p className="mt-4 text-4xl font-bold text-zinc-900 dark:text-zinc-100">$0</p>
            
            <ul className="mt-8 space-y-4">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">100 local tiles</span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Stored on your device</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">50 cloud tiles</span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Sync across devices</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">30 day history</span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Execution tracking</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Web app</span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Status, prompt, memo</p>
                </div>
              </li>
            </ul>

            <Link
              href="/login"
              className="mt-8 block w-full rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-100 p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              POPULAR
            </div>
            <h2 className="text-2xl font-semibold text-white dark:text-zinc-900">Pro</h2>
            <p className="mt-2 text-zinc-300 dark:text-zinc-600">For serious execution control</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${interval === 'monthly' ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100' : 'bg-zinc-800 text-zinc-400 dark:bg-zinc-200 dark:text-zinc-600'}`}
              >Monthly</button>
              <button
                onClick={() => setInterval('yearly')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${interval === 'yearly' ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100' : 'bg-zinc-800 text-zinc-400 dark:bg-zinc-200 dark:text-zinc-600'}`}
              >Yearly <span className="text-green-400">save 17%</span></button>
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-4xl font-bold text-white dark:text-zinc-900">{interval === 'monthly' ? '$5' : '$50'}</span>
              <span className="ml-2 text-zinc-300 dark:text-zinc-600">/{interval === 'monthly' ? 'month' : 'year'}</span>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">10,000 tiles</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Local + cloud storage</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">2 year history</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Long-term tracking</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">100,000 events</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Detailed execution log</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">Desktop sync</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Windows app integration</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">Full dashboard</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Analytics and insights</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-medium text-white dark:text-zinc-900">Condition editing</span>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">Advanced tile configuration</p>
                </div>
              </li>
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="mt-8 block w-full rounded-full bg-white dark:bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
