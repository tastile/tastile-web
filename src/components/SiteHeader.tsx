import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'
import { ThemeToggle } from '@/components/NavControls'

export function SiteHeader({ hideAuth, showFeatureLink = false }: { hideAuth?: boolean; showFeatureLink?: boolean } = {}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-0/90 backdrop-blur-sm">
      <div className="layout-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={36} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex items-center gap-1">
          {showFeatureLink ? (
            <Link href="/#features" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
              Features
            </Link>
          ) : null}
          <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
            Pricing
          </Link>
          <Link href="/download" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
            Download
          </Link>
          <ThemeToggle />
          {!hideAuth && (
            <>
              <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block">
                ログイン
              </Link>
              <Link href="/login" className="ml-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">
                無料で始める
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
