'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useQuickCreateStore } from '@/lib/stores/quick-create-store'
import { useTranslation } from '@/lib/i18n/use-translation'
import { cn } from '@/lib/utils/cn'
import { Plus, Zap, List, Plug, Settings } from 'lucide-react'

interface LeftTabsProps {
  pinnedOpen: boolean
}

export function LeftTabs({ pinnedOpen }: LeftTabsProps) {
  const pathname = usePathname()
  const { open: openQuickCreate } = useQuickCreateStore()
  const { t } = useTranslation()

  return (
    <aside
      className={cn(
        'group flex flex-col gap-2 bg-surface-0 p-2 transition-all duration-200',
        pinnedOpen ? 'w-44' : 'w-14 hover:w-44'
      )}
    >
      {/* New Tile Button - Top */}
      <button
        onClick={openQuickCreate}
        className="relative flex h-12 w-full items-center overflow-hidden rounded-xl bg-primary text-primary-fg transition-all"
        title={t('nav.new')}
      >
        <div className="flex w-10 shrink-0 items-center justify-center">
          <Plus className="h-5 w-5" />
        </div>
        <span className={cn('whitespace-nowrap text-sm font-medium transition-opacity', pinnedOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          {t('nav.new')}
        </span>
      </button>

      {/* Navigation Tabs */}
      <nav className="flex flex-1 flex-col gap-2">
        <TabButton
          icon={<Zap className="h-5 w-5" />}
          label={t('nav.execute')}
          href="/dashboard/execute"
          active={pathname === '/dashboard/execute'}
          expanded={pinnedOpen}
        />
        <TabButton
          icon={<List className="h-5 w-5" />}
          label={t('nav.tiles')}
          href="/dashboard/tiles"
          active={pathname === '/dashboard/tiles'}
          expanded={pinnedOpen}
        />
        <TabButton
          icon={<Plug className="h-5 w-5" />}
          label={t('nav.integrations')}
          href="/dashboard/integrations"
          active={pathname === '/dashboard/integrations'}
          expanded={pinnedOpen}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings - Bottom */}
        <TabButton
          icon={<Settings className="h-5 w-5" />}
          label={t('nav.settings')}
          href="/dashboard/settings"
          active={pathname === '/dashboard/settings'}
          expanded={pinnedOpen}
        />
      </nav>
    </aside>
  )
}

interface TabButtonProps {
  icon: React.ReactNode
  label: string
  href: string
  active: boolean
  expanded: boolean
}

function TabButton({ icon, label, href, active, expanded }: TabButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex h-11 items-center overflow-hidden rounded-lg transition-all',
        active
          ? 'bg-surface-elevated text-foreground'
          : 'text-foreground-muted hover:bg-surface-1 hover:text-foreground'
      )}
    >
      <div className="flex w-10 shrink-0 items-center justify-center">
        {icon}
      </div>
      <span className={cn('whitespace-nowrap text-sm font-medium transition-opacity', expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        {label}
      </span>
    </Link>
  )
}
