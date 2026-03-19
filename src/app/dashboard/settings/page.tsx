'use client'

import { useThemeStore } from '@/lib/stores/theme-store'
import { useLocaleStore } from '@/lib/stores/locale-store'
import { useTranslation } from '@/lib/i18n/use-translation'

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { locale, setLocale } = useLocaleStore()
  const { t } = useTranslation()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      {/* Theme Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t('settings.theme')}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ThemeButton
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            label={t('settings.themeLight')}
            description="White background"
          />
          <ThemeButton
            active={theme === 'gray'}
            onClick={() => setTheme('gray')}
            label={t('settings.themeGray')}
            description="Gray background"
          />
          <ThemeButton
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            label={t('settings.themeDark')}
            description="Dark background"
          />
        </div>
      </section>

      {/* Language Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t('settings.language')}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LanguageButton
            active={locale === 'ja'}
            onClick={() => setLocale('ja')}
            label={t('settings.languageJa')}
          />
          <LanguageButton
            active={locale === 'en'}
            onClick={() => setLocale('en')}
            label={t('settings.languageEn')}
          />
        </div>
      </section>
    </div>
  )
}

interface ThemeButtonProps {
  active: boolean
  onClick: () => void
  label: string
  description: string
}

function ThemeButton({ active, onClick, label, description }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-4 text-left transition-shadow ${
        active
          ? 'bg-primary text-primary-fg shadow-lg'
          : 'bg-surface-2 text-foreground shadow-md hover:shadow-lg'
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-80">{description}</p>
    </button>
  )
}

interface LanguageButtonProps {
  active: boolean
  onClick: () => void
  label: string
}

function LanguageButton({ active, onClick, label }: LanguageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-4 text-left transition-shadow ${
        active
          ? 'bg-primary text-primary-fg shadow-lg'
          : 'bg-surface-2 text-foreground shadow-md hover:shadow-lg'
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
    </button>
  )
}
