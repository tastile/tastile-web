'use client'
import { useLocaleStore } from '@/lib/stores/locale-store'

export function LanguageToggle() {
  const { locale, setLocale } = useLocaleStore()
  return (
    <button
      onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
      className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground transition-colors"
      title={locale === 'ja' ? 'Switch to English' : '日本語に切替'}
    >
      {locale === 'ja' ? 'EN' : 'JA'}
    </button>
  )
}
