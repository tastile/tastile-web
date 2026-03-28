'use client'

import { useEffect, useState } from 'react'
import { PhaseKind } from '@/lib/domain/execution'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'
import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'
import { Actor } from '@/lib/domain/actor'
import { computePhaseMetrics } from '@/lib/projection/dashboard-projection'

interface ActiveExecutionBarProps {
  activeTileTitle: string | null
  phaseKind: PhaseKind
  phaseStartedAt: Date | null
  phaseEndsAt: Date | null
}

export function ActiveExecutionBar({ activeTileTitle, phaseKind, phaseStartedAt, phaseEndsAt }: ActiveExecutionBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const { state, execute } = useExecutionEngineContext()

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!activeTileTitle || !phaseStartedAt || !phaseEndsAt) {
    return (
      <div className="flex items-center justify-center py-4 text-base text-foreground-muted">
        待機中
      </div>
    )
  }

  const metrics = computePhaseMetrics(phaseStartedAt, phaseEndsAt, new Date(nowMs))
  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-4 text-base text-foreground-muted">
        待機中
      </div>
    )
  }

  const phaseLabel = phaseKind === 'break' ? '休憩中' : '実行中'
  const canRequestPrompt = Boolean(state.execution.activeTileId)

  return (
    <div className="flex w-full min-w-0 max-w-2xl items-center gap-4 py-4">
        <TileStatusIcon
          lifecycle="started"
          size={20}
          className="shrink-0"
          onClick={() => {
            if (!canRequestPrompt) return
            void execute(
              {
                type: 'request_prompt',
              tile_id: state.execution.activeTileId,
              requested_at: new Date(),
              reason: 'status_icon',
            },
            Actor.human('self')
            )
          }}
        />

      <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
        {phaseLabel}: {activeTileTitle}
      </span>

      <div className="flex min-w-28 max-w-40 items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-surface-2 border border-border">
          <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${metrics.progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-foreground-muted tabular-nums">
            {Math.round(metrics.progressPercent)}%
          </span>
        </div>

      <span className="text-3xl font-mono font-semibold tabular-nums text-foreground shrink-0">
        {metrics.countdownLabel}
      </span>
    </div>
  )
}
