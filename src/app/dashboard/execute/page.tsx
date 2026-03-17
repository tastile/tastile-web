'use client'

import { useMemo } from 'react'
import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { ActiveExecutionBar } from '@/components/execution/ActiveExecutionBar'
import { NextTileCard } from '@/components/tiles/NextTileCard'
import { TimelineView } from '@/components/timeline/TimelineView'
import { TileCardExpandable } from '@/components/tiles/TileCardExpandable'
import { buildTimelineView } from '@/lib/core/reducer'
import { selectNextTile } from '@/lib/scheduler/simple-jit'
import { getTileLifecycle } from '@/lib/domain/tile'
import { Actor } from '@/lib/domain/actor'
import { TileId } from '@/lib/domain/ids'

export default function ExecutePage() {
  const { state, loading, execute } = useExecutionEngine()

  const activeTile = state.execution.activeTileId ? state.tiles.get(state.execution.activeTileId) ?? null : null
  const suggestion = useMemo(() => selectNextTile(state), [state])
  const timeline = useMemo(() => buildTimelineView(state), [state])

  async function startTile(tileId: TileId) {
    await execute(
      { type: 'start_tile', tile_id: tileId, started_at: new Date(), source: 'manual' },
      Actor.human('self')
    )
  }

  async function completeActive() {
    if (!state.execution.activeTileId) return
    await execute(
      {
        type: 'complete_tile',
        tile_id: state.execution.activeTileId,
        completed_at: new Date(),
        next_tile_id: null,
      },
      Actor.human('self')
    )
  }

  if (loading) return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Execute</h1>

      <div className="rounded-xl bg-surface-1 p-4">
        <ActiveExecutionBar
          activeTileTitle={activeTile?.core.title ?? null}
          phaseKind={state.execution.phaseKind}
          phaseStartedAt={state.execution.phaseStartedAt}
          phaseEndsAt={state.execution.phaseEndsAt}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">Next Tile</h2>
          <NextTileCard tile={suggestion?.tile ?? null} reason={suggestion?.reason} onStart={startTile} loading={loading} />
        </div>

        <div className="rounded-xl bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">Timeline</h2>
          <TimelineView mode="compact" segments={timeline} />
        </div>
      </div>

      <div className="rounded-xl bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">Ready Tiles</h2>
          <button
            type="button"
            onClick={completeActive}
            disabled={!state.execution.activeTileId}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-fg disabled:opacity-50"
          >
            Complete Active Tile
          </button>
        </div>
        <div className="space-y-2">
          {Array.from(state.tiles.values())
            .filter(tile => getTileLifecycle(tile) !== 'done')
            .map(tile => (
              <TileCardExpandable
                key={tile.core.id}
                tile={tile}
                defaultExpanded={false}
                onStart={startTile}
                onComplete={completeActive}
                onDefer={(id) => console.log('Defer', id)}
                onInterrupt={(id) => console.log('Interrupt', id)}
                onEdit={(id) => console.log('Edit', id)}
                onDelete={(id) => console.log('Delete', id)}
              />
            ))}
          {state.tiles.size === 0 ? (
            <p className="text-sm text-foreground-muted">No tiles yet. Create one with Cmd/Ctrl+N.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
