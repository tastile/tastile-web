'use client'

import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { TileCardExpandable } from '@/components/tiles/TileCardExpandable'
import { Actor } from '@/lib/domain/actor'

export default function TilesPage() {
  const { state, loading, execute } = useExecutionEngine()

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

  if (loading) return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>

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
            onDefer={(id) => console.log('Defer', id)}
            onInterrupt={(id) => console.log('Interrupt', id)}
            onEdit={(id) => console.log('Edit', id)}
            onDelete={(id) => console.log('Delete', id)}
          />
        ))}
      </div>
      {state.tiles.size === 0 ? (
        <p className="text-sm text-foreground-muted">No tiles yet. Use Cmd/Ctrl+N to create one.</p>
      ) : null}
    </div>
  )
}
