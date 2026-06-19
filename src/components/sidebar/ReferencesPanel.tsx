"use client";

import { useTileList } from "@/lib/hooks/use-tile-list";
import { useLabelsStore } from "@/lib/stores/labels-store";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { groupTilesByLabel } from "@/lib/projection/label-grouping";
import { cn } from "@/lib/utils/cn";

export function ReferencesPanel() {
  const { tiles, loading } = useTileList({ viewMode: "list", limit: 500 });
  const ensureLabel = useLabelsStore((s) => s.ensureLabel);
  const labelColors = useLabelsStore((s) => s.labels);
  const { enabled, toggle } = useReferenceOverlayStore();

  const groups = groupTilesByLabel(tiles.map((t) => ({ id: t.id, labels: t.labels })));

  if (loading) {
    return <div className="p-4 text-xs text-foreground-subtle">Loading…</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 text-xs text-foreground-subtle">
        No labels found. Add labels to tiles to see them here.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        References
      </div>
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
              "flex items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-surface-2",
              !isOn && "opacity-40",
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1 truncate text-foreground">{g.name}</span>
            <span className="font-mono text-[10px] text-foreground-subtle">{g.count}</span>
          </button>
        );
      })}
    </div>
  );
}
