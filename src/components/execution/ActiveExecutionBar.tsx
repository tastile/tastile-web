'use client'

import { useEffect, useState } from 'react'
import { PhaseKind } from '@/lib/domain/execution'

interface ActiveExecutionBarProps {
  activeTileTitle: string | null
  phaseKind: PhaseKind
  phaseStartedAt: Date | null
  phaseEndsAt: Date | null
}

export function ActiveExecutionBar({ activeTileTitle, phaseKind, phaseStartedAt, phaseEndsAt }: ActiveExecutionBarProps) {
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setNowMs(Date.now())
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
    <div className="flex items-center gap-6 max-w-2xl border-l-4 border-primary pl-4 py-4">
      {/* Pulsing indicator */}
      <div className="relative shrink-0">
        <div className="h-3 w-3 rounded-full bg-primary" />
        <div className="absolute inset-0 h-3 w-3 rounded-full bg-primary animate-ping opacity-75" />
      </div>

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
