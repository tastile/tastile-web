'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { cn } from '@/lib/utils/cn'

interface LoadingCardProps {
  variant?: 'compact' | 'comfortable' | 'detailed'
}

export function LoadingCard({ variant = 'comfortable' }: LoadingCardProps) {
  const { t } = useTranslation()

  return (
    <div className={cn(
      "rounded-xl bg-surface-1 text-sm text-foreground-muted",
      variant === 'compact' && "p-3",
      variant === 'comfortable' && "p-3",
      variant === 'detailed' && "p-4"
    )}>
      {t('common.loading')}
    </div>
  )
}
