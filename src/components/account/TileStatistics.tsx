"use client";

import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";

export function TileStatistics() {
  const { state, loading } = useExecutionEngineContext();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 bg-surface-2 rounded-lg">
              <div className="h-4 w-24 bg-surface-1 animate-pulse rounded mb-2" />
              <div className="h-8 w-16 bg-surface-1 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tiles = Array.from(state.tiles.values());
  const total = tiles.length;
  const completed = tiles.filter((tile) => tile.core.completedAt != null).length;
  const started = tiles.filter(
    (tile) => tile.core.startedAt != null && tile.core.completedAt == null,
  ).length;
  const ready = tiles.filter((tile) => tile.core.startedAt == null).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-surface-2 rounded-lg">
            <div className="text-sm font-medium text-foreground-muted mb-1">Total Tiles</div>
            <div className="text-3xl font-bold text-foreground">{total}</div>
          </div>

          <div className="p-6 bg-surface-2 rounded-lg">
            <div className="text-sm font-medium text-foreground-muted mb-1">Completed</div>
            <div className="text-3xl font-bold text-success">{completed}</div>
          </div>

          <div className="p-6 bg-surface-2 rounded-lg">
            <div className="text-sm font-medium text-foreground-muted mb-1">Completion Rate</div>
            <div className="text-3xl font-bold text-primary">{completionRate}%</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Breakdown by Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-2 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-muted">Ready</div>
                <div className="text-2xl font-bold text-foreground mt-1">{ready}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xl">●</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-2 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-muted">In Progress</div>
                <div className="text-2xl font-bold text-foreground mt-1">{started}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <span className="text-warning text-xl">●</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-2 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground-muted">Done</div>
                <div className="text-2xl font-bold text-foreground mt-1">{completed}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <span className="text-success text-xl">●</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="p-6 bg-surface-2 rounded-lg">
          <p className="text-sm text-foreground-muted text-center">
            No tiles yet. Create your first tile to start tracking statistics.
          </p>
        </div>
      )}
    </div>
  );
}
