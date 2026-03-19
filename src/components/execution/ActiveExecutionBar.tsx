'use client'

import { useEffect, useState } from 'react'
import { PhaseKind } from '@/lib/domain/execution'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'

interface ActiveExecutionBarProps {
  activeTileTitle: string | null
  phaseKind: PhaseKind
  phaseStartedAt: Date | null
  phaseEndsAt: Date | null
}

export function ActiveExecutionBar({ activeTileTitle, phaseKind, phaseStartedAt, phaseEndsAt }: ActiveExecutionBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!activeTileTitle || phaseKind !== 'work' || !phaseStartedAt || !phaseEndsAt) {
    return (
      <div className="flex items-center justify-center py-4 text-base text-foreground-muted">
        待機中
      </div>
    )
  }

  const totalSeconds = Math.max(1, Math.floor((phaseEndsAt.getTime() - phaseStartedAt.getTime()) / 1000))
  const elapsed = Math.max(0, Math.floor((nowMs - phaseStartedAt.getTime()) / 1000))
  const remaining = Math.max(0, totalSeconds - elapsed)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const progress = Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100))

  return (
    <div className="flex items-center gap-6 max-w-2xl py-4">
      <TileStatusIcon lifecycle="started" size={20} className="shrink-0" />

      <span className="text-base font-semibold text-foreground truncate">
        {activeTileTitle}
      </span>

      <div className="flex items-center gap-2 min-w-32">
        <div className="h-1.5 flex-1 rounded-full bg-surface-2 border border-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-foreground-muted tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      <span className="text-3xl font-mono font-semibold tabular-nums text-foreground shrink-0">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}
