"use client";

import { useTileList, type TileListView } from "@/lib/hooks/use-tile-list";

function formatNextStart(tile: TileListView): string {
  if (!tile.projectedNextStartAt) return "—";
  const d = new Date(tile.projectedNextStartAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH}h ${diffMin % 60}m`;
}

export function SchedulePanel() {
  const { tiles, loading } = useTileList({ viewMode: "list", limit: 500 });
  const recurring = tiles.filter((t) => t.objectiveMode === "recurring");

  if (loading) {
    return <div className="p-4 text-xs text-foreground-subtle">Loading…</div>;
  }

  if (recurring.length === 0) {
    return (
      <div className="p-4 text-xs text-foreground-subtle">
        No recurring tiles found.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        Schedule
      </div>
      {recurring.map((tile) => (
        <div
          key={tile.id}
          className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-surface-2"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-foreground">{tile.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-foreground-subtle">
            {tile.targetWorkMin ? `${tile.targetWorkMin}m` : "—"}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-foreground-subtle">
            next: {formatNextStart(tile)}
          </span>
        </div>
      ))}
    </div>
  );
}
