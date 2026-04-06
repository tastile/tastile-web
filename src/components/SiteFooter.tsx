import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'

interface SiteFooterProps {
  labels?: {
    webApp: string
    download: string
    pricing: string
    privacy: string
    terms: string
  }
}

const defaultLabels = {
  webApp: 'Web App',
  download: 'Download',
  pricing: 'Pricing',
  privacy: 'Privacy',
  terms: 'Terms',
}

export function SiteFooter({ labels = defaultLabels }: SiteFooterProps = {}) {
  return (
    <footer className="border-t border-border bg-surface-0 py-10">
      <div className="layout-shell grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={34} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-muted">
          <Link href="/login" className="hover:text-foreground">{labels.webApp}</Link>
          <Link href="/download" className="hover:text-foreground">{labels.download}</Link>
          <Link href="/pricing" className="hover:text-foreground">{labels.pricing}</Link>
          <Link href="/privacy" className="hover:text-foreground">{labels.privacy}</Link>
          <Link href="/terms" className="hover:text-foreground">{labels.terms}</Link>
        </nav>
        <p className="text-xs text-foreground-subtle md:text-right">&copy; 2026 Tastile. All rights reserved.</p>
      </div>
    </footer>
  )
}
