"use client";

import { useTileList } from "@/lib/hooks/use-tile-list";
import { useLabelsStore } from "@/lib/stores/labels-store";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { groupTilesByLabel } from "@/lib/projection/label-grouping";
import { cn } from "@/lib/utils/cn";

export function ReferencesSidePanel() {
  const { tiles, loading } = useTileList({ viewMode: "list", limit: 500 });
  const ensureLabel = useLabelsStore((s) => s.ensureLabel);
  const labelColors = useLabelsStore((s) => s.labels);
  const { enabled, toggle } = useReferenceOverlayStore();

  const groups = groupTilesByLabel(tiles.map((t) => ({ id: t.id, labels: t.labels })));

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="px-4 pt-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Reference Labels
        </span>
      </div>

      <div className="px-2">
        {loading && <div className="px-2 py-1 text-xs text-foreground-subtle">Loading…</div>}
        {!loading && groups.length === 0 && (
          <div className="px-2 py-1 text-xs text-foreground-subtle">No labels found.</div>
        )}
        <div className="flex flex-col space-y-0.5">
          {groups.map((g) => {
            ensureLabel(g.name);
            const color = labelColors[g.name]?.color ?? "#6b7280";
            const isOn = enabled.includes(g.name);
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => toggle(g.name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isOn
                    ? "bg-surface-elevated font-medium text-foreground"
                    : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !isOn && "opacity-40")}
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="font-mono text-[10px] opacity-60">{g.tileIds.length}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
