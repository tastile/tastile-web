'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'
import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'
import { Actor } from '@/lib/domain/actor'

export function ActiveExecutionBadge() {
  const { state, execute } = useExecutionEngineContext()
  const { t } = useTranslation()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const activeTile = state.execution.activeTileId ? state.tiles.get(state.execution.activeTileId) ?? null : null
  const remaining = useMemo(() => {
    if (!state.execution.phaseEndsAt) return 0
    return Math.max(0, Math.floor((state.execution.phaseEndsAt.getTime() - nowMs) / 1000))
  }, [state.execution.phaseEndsAt, nowMs])
  const canRequestPrompt = Boolean(state.execution.activeTileId)

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!activeTile) {
    return (
      <div className="text-sm text-foreground-muted">
        {t('common.loading')}
      </div>
    )
  }
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface-1 border border-primary/30">
        <TileStatusIcon
          lifecycle="started"
          size={16}
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

      <span className="text-sm font-semibold text-foreground">{activeTile.core.title}</span>
      <span className="text-sm font-mono font-semibold tabular-nums text-primary">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}
