import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'

export function SiteHeader({ hideAuth }: { hideAuth?: boolean } = {}) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TastileLogo size={22} className="text-zinc-900 dark:text-zinc-100" />
          <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">tastile</span>
        </Link>
        {!hideAuth && (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              ログイン
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
