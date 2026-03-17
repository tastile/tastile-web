'use client'

import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { TileCardExpandable } from '@/components/tiles/TileCardExpandable'
import { Actor } from '@/lib/domain/actor'
import { useDialogStore } from '@/lib/stores/dialog-store'
import { DeferTileDialog } from '@/components/tiles/dialogs/DeferTileDialog'
import { DeleteTileDialog } from '@/components/tiles/dialogs/DeleteTileDialog'
import { LoadingCard } from '@/components/tiles/shared/LoadingCard'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TilesPage() {
  const { state, loading, execute } = useExecutionEngine()
  const { openDeferDialog, openDeleteDialog } = useDialogStore()

  async function handleStart(tileId: string) {
    await execute(
      { type: 'start_tile', tile_id: tileId as any, started_at: new Date(), source: 'manual' },
      Actor.human('self')
    )
  }

  async function handleComplete(tileId: string) {
    await execute(
      { type: 'complete_tile', tile_id: tileId as any, completed_at: new Date(), next_tile_id: null },
      Actor.human('self')
    )
  }

  async function handleDefer(tileId: string) {
    const tile = state.tiles.get(tileId as any)
    if (!tile) return
    openDeferDialog(tile, 'defer')
  }

  async function handleInterrupt(tileId: string) {
    const tile = state.tiles.get(tileId as any)
    if (!tile) return
    openDeferDialog(tile, 'interrupt')
  }

  async function handleDeferConfirm(tileId: string, nextStartAt: Date) {
    await execute(
      { type: 'defer_tile', tile_id: tileId as any, deferred_at: new Date(), next_start_at: nextStartAt },
      Actor.human('self')
    )
  }

  async function handleDelete(tileId: string) {
    const tile = state.tiles.get(tileId as any)
    if (!tile) return
    openDeleteDialog(tile)
  }

  async function handleDeleteConfirm(tileId: string) {
    await execute(
      { type: 'delete_tile', tile_id: tileId as any, deleted_at: new Date() },
      Actor.human('self')
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <LoadingCard key={i} variant="comfortable" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Tiles</h1>
      <div className="space-y-2">
        {Array.from(state.tiles.values()).map(tile => (
          <TileCardExpandable
            key={tile.core.id}
            tile={tile}
            onStart={handleStart}
            onComplete={handleComplete}
            onDefer={handleDefer}
            onInterrupt={handleInterrupt}
            onEdit={(id) => console.log('Edit', id)}
            onDelete={handleDelete}
          />
        ))}
      </div>
      {state.tiles.size === 0 ? (
        <p className="text-sm text-foreground-muted">No tiles yet. Use Cmd/Ctrl+N to create one.</p>
      ) : null}

      {/* Dialogs */}
      <DeferTileDialog onConfirm={handleDeferConfirm} />
      <DeleteTileDialog onConfirm={handleDeleteConfirm} />
    </div>
  )
}
