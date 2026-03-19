'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { mockExecutionState } from '@/lib/mock-data'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'

export function ActiveExecutionBadge() {
  const [elapsed, setElapsed] = useState(mockExecutionState.elapsedSeconds)
  const { activeTile, totalSeconds } = mockExecutionState
  const { t } = useTranslation()

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!activeTile) {
    return (
      <div className="text-sm text-foreground-muted">
        {t('common.loading')}
      </div>
    )
  }

  const remaining = totalSeconds - elapsed
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface-1 border border-primary/30">
      <TileStatusIcon lifecycle="started" size={16} className="shrink-0" />

      <span className="text-sm font-semibold text-foreground">{activeTile.title}</span>
      <span className="text-sm font-mono font-semibold tabular-nums text-primary">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}
