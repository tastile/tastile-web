'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { ActiveExecutionBar } from '@/components/execution/ActiveExecutionBar'
import { ActiveExecutionBadge } from '@/components/execution/ActiveExecutionBadge'
import { TastileLogo } from '@/components/TastileLogo'
import { Menu, Bell } from 'lucide-react'
import { getIdTokenClaims } from '@/lib/daemon/id-token-client'
import { useEffect, useState } from 'react'
import { AccountMenu } from '@/app/app/account-menu'
import { ExecutionSyncStatus } from '@/lib/domain/execution'

interface HeaderProps {
  railPinned: boolean
  onToggleRail: () => void
  executionState?: {
    activeTileTitle: string | null
    phaseKind: 'work' | 'break' | 'idle'
    phaseStartedAt: Date | null
    phaseEndsAt: Date | null
    nextActionableStartAt?: Date | null
    syncStatus?: ExecutionSyncStatus | null
  }
}

export function Header({ railPinned, onToggleRail, executionState }: HeaderProps) {
  const { t } = useTranslation()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userData, setUserData] = useState<{
    displayName: string
    email: string
    plan: string
  } | null>(null)

  useEffect(() => {
    void (async () => {
      const claims = await getIdTokenClaims()
      if (!claims) {
        setAvatarUrl(null)
        setUserData(null)
        return
      }

      const fallbackName =
        claims.email?.split('@')[0] ?? claims.sub.slice(0, 8)

      setAvatarUrl(claims.picture ?? null)
      setUserData({
        displayName: claims.name ?? fallbackName,
        email: claims.email ?? '',
        plan: 'free', // TODO: plan lookup lives on the daemon; not wired in β.
      })
    })()
  }, [])

  return (
    <>
      <header className="flex h-14 items-center justify-between rounded-lg border border-border bg-surface-elevated px-4 lg:hidden">
        <ActiveExecutionBadge />
      </header>

      <header className="hidden h-16 items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3 lg:flex">
        <div className="flex h-full w-14 shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onToggleRail}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-1 transition-colors hover:bg-surface-2"
            aria-label={railPinned ? 'Collapse navigation rail' : 'Expand navigation rail'}
            title={railPinned ? 'Collapse navigation rail' : 'Expand navigation rail'}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 w-56 shrink-0 rounded-lg border border-border bg-surface-1 px-3 py-1">
          <ActiveExecutionBar
            mode="header-left"
            activeTileTitle={executionState?.activeTileTitle ?? null}
            phaseKind={executionState?.phaseKind ?? 'idle'}
            phaseStartedAt={executionState?.phaseStartedAt ?? null}
            phaseEndsAt={executionState?.phaseEndsAt ?? null}
            nextActionableStartAt={executionState?.nextActionableStartAt ?? null}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <TastileLogo size={28} className="text-foreground" />
          <span className="text-base font-semibold tracking-tight text-foreground">Tastile</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end">
          {executionState?.activeTileTitle ? (
            <div className="min-w-0 max-w-md rounded-lg border border-border bg-surface-1 px-3 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{executionState.activeTileTitle}</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-1 transition-colors hover:bg-surface-2"
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
            <div className="h-9 w-9 rounded-full border border-border bg-surface-2" aria-label="User avatar placeholder" />
          )}
        </div>
      </header>
    </>
  )
}
