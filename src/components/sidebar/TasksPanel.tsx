"use client";

import { useMemo, useState } from "react";
import { useTileList, type TileListView } from "@/lib/hooks/use-tile-list";

function lifecycleIcon(lifecycle: string) {
  if (lifecycle === "started") return "◉";
  if (lifecycle === "done") return "✓";
  if (lifecycle === "closed") return "✕";
  return "○";
}

function dueBucket(tile: TileListView): string {
  if (tile.lifecycle === "done" || tile.lifecycle === "closed") return "Closed";
  if (!tile.dueAt) return "No date";
  const due = new Date(tile.dueAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000 + 86400000);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);
  if (due < startOfToday) return "Overdue";
  if (due < startOfTomorrow) return "Today";
  if (due < endOfWeek) return "This Week";
  return "Later";
}

const BUCKET_ORDER = ["Overdue", "Today", "This Week", "Later", "No date", "Closed"];

export function TasksPanel() {
  const [search, setSearch] = useState("");
  const { tiles, loading } = useTileList({ viewMode: "list", limit: 200, search: search || undefined });

  const grouped = useMemo(() => {
    const map = new Map<string, TileListView[]>();
    for (const tile of tiles) {
      const bucket = dueBucket(tile);
      const arr = map.get(bucket) ?? [];
      arr.push(tile);
      map.set(bucket, arr);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      bucket: b,
      tiles: map.get(b)!,
    }));
  }, [tiles]);

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <input
          type="text"
          placeholder="Search tiles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md bg-surface-2 px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle"
        />
      </div>
      {loading && <div className="px-4 py-2 text-xs text-foreground-subtle">Loading…</div>}
      {grouped.map(({ bucket, tiles: bucketTiles }) => (
        <div key={bucket}>
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            {bucket}
          </div>
          {bucketTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs hover:bg-surface-2"
            >
              <span className="text-foreground-subtle">{lifecycleIcon(tile.lifecycle)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-foreground">{tile.title}</span>
              {tile.targetWorkMin ? (
                <span className="shrink-0 font-mono text-[10px] text-foreground-subtle">{tile.targetWorkMin}m</span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
