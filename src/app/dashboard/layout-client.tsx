'use client'

import { AppShell } from '@/components/layout/AppShell'
import { QuickTileCreate } from '@/components/tiles/QuickTileCreate'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { useEffect, useMemo } from 'react'
import { useQuickCreateStore } from '@/lib/stores/quick-create-store'
import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { selectNextTile } from '@/lib/scheduler/simple-jit'
import { getTileLifecycle } from '@/lib/domain/tile'
import { Actor } from '@/lib/domain/actor'
import { TileId } from '@/lib/domain/ids'

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { open } = useQuickCreateStore()
  const { state, loading, execute } = useExecutionEngine()

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

  // Keyboard shortcut: Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        open()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  async function handleStartSuggested(tileId: TileId) {
    await execute(
      { type: 'start_tile', tile_id: tileId, started_at: new Date(), source: 'manual' },
      Actor.human('self')
    )
  }

  return (
    <AppShell
      quickCreatePanel={<QuickTileCreate />}
      rightSidebar={
        <RightSidebar
          nextTile={suggestion?.tile ?? null}
          nextReason={suggestion?.reason}
          onStartSuggested={handleStartSuggested}
          timelineTiles={timelineTiles}
          loading={loading}
        />
      }
      executionState={{
        activeTileTitle: state.execution.activeTileId
          ? state.tiles.get(state.execution.activeTileId)?.core.title ?? null
          : null,
        phaseKind: state.execution.phaseKind,
        phaseStartedAt: state.execution.phaseStartedAt,
        phaseEndsAt: state.execution.phaseEndsAt,
      }}
    >
      {children}
    </AppShell>
  )
}
