'use client'

import { useState } from 'react'
import { TileStatistics } from '@/components/account/TileStatistics'
import { SubscriptionSection } from '@/components/account/SubscriptionSection'

type TabId = 'profile' | 'subscription' | 'statistics' | 'usage'

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'profile', label: 'Profile' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'usage', label: 'Usage' }
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Account Settings</h1>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6" aria-label="Account settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-foreground-secondary hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl">
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Profile Information</h2>
            <p className="text-foreground-secondary">
              Manage your profile details and preferences.
            </p>
            <div className="p-4 bg-surface-secondary rounded-lg border border-border">
              <p className="text-sm text-foreground-tertiary">Profile settings coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Subscription</h2>
            <p className="text-foreground-secondary">
              Manage your subscription plan and billing.
            </p>
            <SubscriptionSection />
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Tile Statistics</h2>
            <p className="text-foreground-secondary">
              View your tile usage and completion metrics.
            </p>
            <TileStatistics />
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Usage Dashboard</h2>
            <p className="text-foreground-secondary">
              Track your activity and productivity over time.
            </p>
            <div className="p-4 bg-surface-secondary rounded-lg border border-border">
              <p className="text-sm text-foreground-tertiary">Usage charts coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
