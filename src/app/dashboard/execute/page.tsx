'use client'

import { useMemo } from 'react'
import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { ActiveExecutionBar } from '@/components/execution/ActiveExecutionBar'
import { TileCardCompact } from '@/components/tiles/TileCardCompact'
import { TileCardExpandable } from '@/components/tiles/TileCardExpandable'
import { selectNextTile } from '@/lib/scheduler/simple-jit'
import { getTileLifecycle } from '@/lib/domain/tile'
import { Actor } from '@/lib/domain/actor'
import { TileId } from '@/lib/domain/ids'
import { useDialogStore } from '@/lib/stores/dialog-store'
import { DeferTileDialog } from '@/components/tiles/dialogs/DeferTileDialog'
import { DeleteTileDialog } from '@/components/tiles/dialogs/DeleteTileDialog'
import { LoadingCard } from '@/components/tiles/shared/LoadingCard'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ExecutePage() {
  const { state, loading, execute } = useExecutionEngine()
  const { openDeferDialog, openDeleteDialog } = useDialogStore()

  const activeTile = state.execution.activeTileId ? state.tiles.get(state.execution.activeTileId) ?? null : null
  const suggestion = useMemo(() => selectNextTile(state), [state])
  const timelineTiles = useMemo(() => {
    return Array.from(state.tiles.values())
      .filter(tile => getTileLifecycle(tile) !== 'done')
      .sort((a, b) => {
        const aTime = a.temporal.fixedStart?.getTime() ?? Infinity
        const bTime = b.temporal.fixedStart?.getTime() ?? Infinity
        return aTime - bTime
      })
  }, [state])

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

  async function handleDefer(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId))
    if (!tile) return
    openDeferDialog(tile, 'defer')
  }

  async function handleInterrupt(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId))
    if (!tile) return
    openDeferDialog(tile, 'interrupt')
  }

  async function handleDeferConfirm(tileId: string, nextStartAt: Date) {
    await execute(
      { type: 'defer_tile', tile_id: toTileId(tileId), deferred_at: new Date(), next_start_at: nextStartAt },
      Actor.human('self')
    )
  }

  async function handleDelete(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId))
    if (!tile) return
    openDeleteDialog(tile)
  }

  async function handleDeleteConfirm(tileId: string) {
    await execute(
      { type: 'delete_tile', tile_id: toTileId(tileId), deleted_at: new Date() },
      Actor.human('self')
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-xl bg-surface-1 p-4">
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-surface-1 p-4">
            <Skeleton className="mb-3 h-4 w-24" />
            <LoadingCard variant="compact" />
          </div>
          <div className="rounded-xl bg-surface-1 p-4">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

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
          <TileCardCompact tile={suggestion?.tile ?? null} onStart={startTile} loading={loading} />
        </div>

        <div className="rounded-xl bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">Timeline</h2>
          <div className="space-y-2">
            {timelineTiles.map(tile => (
              <TileCardCompact key={tile.core.id} tile={tile} onStart={startTile} loading={loading} />
            ))}
            {timelineTiles.length === 0 && (
              <p className="text-sm text-foreground-muted">No upcoming tiles</p>
            )}
          </div>
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
                onDefer={handleDefer}
                onInterrupt={handleInterrupt}
                onEdit={(id) => console.log('Edit', id)}
                onDelete={handleDelete}
              />
            ))}
          {state.tiles.size === 0 ? (
            <p className="text-sm text-foreground-muted">No tiles yet. Click the + button to create one.</p>
          ) : null}
        </div>
      </div>

      {/* Dialogs */}
      <DeferTileDialog onConfirm={handleDeferConfirm} />
      <DeleteTileDialog onConfirm={handleDeleteConfirm} />
    </div>
  )
}
  function toTileId(tileId: string) {
    return TileId.fromString(tileId)
  }
