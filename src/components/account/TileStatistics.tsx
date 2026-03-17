'use client'

import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'

export function TileStatistics() {
  const { state, loading } = useExecutionEngine()

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-secondary animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 bg-surface-secondary rounded-lg border border-border">
              <div className="h-4 w-24 bg-surface-tertiary animate-pulse rounded mb-2" />
              <div className="h-8 w-16 bg-surface-tertiary animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const tiles = Array.from(state.tiles.values())
  const total = tiles.length
  const completed = tiles.filter(tile => tile.core.completedAt != null).length
  const started = tiles.filter(tile => tile.core.startedAt != null && tile.core.completedAt == null).length
  const ready = tiles.filter(tile => tile.core.startedAt == null).length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-surface-secondary rounded-lg border border-border">
            <div className="text-sm font-medium text-foreground-secondary mb-1">Total Tiles</div>
            <div className="text-3xl font-bold text-foreground">{total}</div>
          </div>

          <div className="p-6 bg-surface-secondary rounded-lg border border-border">
            <div className="text-sm font-medium text-foreground-secondary mb-1">Completed</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{completed}</div>
          </div>

          <div className="p-6 bg-surface-secondary rounded-lg border border-border">
            <div className="text-sm font-medium text-foreground-secondary mb-1">Completion Rate</div>
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{completionRate}%</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Breakdown by Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-secondary rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-secondary">Ready</div>
                <div className="text-2xl font-bold text-foreground mt-1">{ready}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 text-xl">●</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-secondary">In Progress</div>
                <div className="text-2xl font-bold text-foreground mt-1">{started}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-400 text-xl">●</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-secondary">Done</div>
                <div className="text-2xl font-bold text-foreground mt-1">{completed}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 text-xl">●</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="p-6 bg-surface-secondary rounded-lg border border-border">
          <p className="text-sm text-foreground-tertiary text-center">
            No tiles yet. Create your first tile to start tracking statistics.
          </p>
        </div>
      )}
    </div>
  )
}
