'use client'

import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'
import { ThemeToggle } from '@/components/NavControls'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useTranslation } from '@/lib/i18n/use-translation'

export function SiteHeader({ hideAuth, showFeatureLink = false }: { hideAuth?: boolean; showFeatureLink?: boolean } = {}) {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-40 bg-surface-0/90 backdrop-blur-sm">
      <div className="layout-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={36} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex items-center gap-1">
          {showFeatureLink ? (
            <Link href="/#features" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
              {t('marketing.nav.features')}
            </Link>
          ) : null}
          <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
            {t('marketing.nav.pricing')}
          </Link>
          <Link href="/download" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
            {t('marketing.nav.download')}
          </Link>
          <ThemeToggle />
          <LanguageToggle />
          {!hideAuth && (
            <>
              <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
                {t('marketing.nav.login')}
              </Link>
              <Link href="/login" className="ml-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-interactive-hover">
                {t('marketing.nav.getStarted')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
