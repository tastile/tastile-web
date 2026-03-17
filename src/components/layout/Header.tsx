'use client'

import { useIsMobile } from '@/lib/hooks/use-media-query'
import { useQuickCreateStore } from '@/lib/stores/quick-create-store'
import { useTranslation } from '@/lib/i18n/use-translation'
import { ActiveExecutionBar } from '@/components/execution/ActiveExecutionBar'
import { ActiveExecutionBadge } from '@/components/execution/ActiveExecutionBadge'
import { TastileLogo } from '@/components/TastileLogo'
import { Plus, Menu, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { AccountMenu } from '@/app/app/account-menu'

interface HeaderProps {
  railPinned: boolean
  onToggleRail: () => void
  executionState?: {
    activeTileTitle: string | null
    phaseKind: 'work' | 'break' | 'idle'
    phaseStartedAt: Date | null
    phaseEndsAt: Date | null
  }
}

export function Header({ railPinned, onToggleRail, executionState }: HeaderProps) {
  const isMobile = useIsMobile()
  const { open: openQuickCreate } = useQuickCreateStore()
  const { t } = useTranslation()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userData, setUserData] = useState<{
    displayName: string
    email: string
    plan: string
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setAvatarUrl(null)
        setUserData(null)
        return
      }

      const metadata = data.user.user_metadata
      const googleAvatar =
        (typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null) ??
        (typeof metadata?.picture === 'string' ? metadata.picture : null)

      setAvatarUrl(googleAvatar)
      setUserData({
        displayName: metadata?.full_name ?? metadata?.name ?? data.user.email?.split('@')[0] ?? 'User',
        email: data.user.email ?? '',
        plan: 'free', // TODO: Get from Supabase profiles table
      })
    })
  }, [])

  if (isMobile) {
    return (
      <header className="flex h-14 items-center justify-between bg-surface-elevated px-4">
        <button className="flex items-center justify-center" title={t('header.menu')}>
          <Menu className="h-5 w-5" />
        </button>

        <ActiveExecutionBadge />

        <button
          onClick={openQuickCreate}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg"
          title={t('nav.new')}
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>
    )
  }

  return (
    <header className="flex h-16 items-center gap-4 rounded-2xl bg-surface-elevated pr-5">
      <div className="flex h-full w-14 shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={onToggleRail}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2"
          aria-label={railPinned ? 'Collapse navigation rail' : 'Expand navigation rail'}
          title={railPinned ? 'Collapse navigation rail' : 'Expand navigation rail'}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Left - Tastile Icon + Title */}
      <div className="flex shrink-0 items-center gap-2">
        <TastileLogo size={28} className="text-foreground" />
        <span className="text-base font-semibold tracking-tight text-foreground">Tastile</span>
      </div>

      {/* Center - Active Execution */}
      <div className="flex flex-1 items-center justify-center">
        <ActiveExecutionBar
          activeTileTitle={executionState?.activeTileTitle ?? null}
          phaseKind={executionState?.phaseKind ?? 'idle'}
          phaseStartedAt={executionState?.phaseStartedAt ?? null}
          phaseEndsAt={executionState?.phaseEndsAt ?? null}
        />
      </div>

      {/* Right - Notifications & Avatar */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2"
          title={t('header.notifications')}
        >
          <Bell className="h-5 w-5" />
        </button>
        {userData ? (
          <AccountMenu
            displayName={userData.displayName}
            avatarUrl={avatarUrl}
            plan={userData.plan}
            email={userData.email}
            menuPlacement="down"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-surface-2" aria-label="User avatar placeholder" />
        )}
      </div>
    </header>
  )
}
