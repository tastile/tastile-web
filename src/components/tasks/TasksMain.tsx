"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

export function TasksMain() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const range = searchParams.get("range") ?? "7d"; // デフォルト7日
  const granularity = searchParams.get("granularity") ?? "no_breaks,min_0m";

  const { tiles, loading } = useTileList({
    viewMode: "by_state",
    limit: 200,
    search: search || undefined,
    range,
    granularity,
  });

  const filterDesc = useMemo(() => {
    const parts = [];

    const num = parseInt(range, 10);
    const unit = range.slice(-1);
    const unitStr = unit === "d" ? "days" : unit === "w" ? "weeks" : unit === "m" ? "months" : "";
    if (!Number.isNaN(num)) {
      parts.push(`Range: ${num} ${unitStr}`);
    }

    const gParts = granularity.split(",");
    const minPart = gParts.find((p) => p.startsWith("min_"));
    if (minPart) {
      const mins = minPart.replace("min_", "").replace("m", "");
      if (mins !== "0") {
        parts.push(`Min duration: ${mins}m`);
      }
    }

    if (gParts.includes("important_only")) {
      parts.push("High Priority");
    }
    if (gParts.includes("no_low_priority")) {
      parts.push("No Low Priority");
    }

    if (search) {
      parts.push(`Search: "${search}"`);
    }

    return parts.length > 0 ? parts.join(" • ") : "All Tasks";
  }, [range, granularity, search]);

  return (
    <PageContainer>
      <PageHeader title="Tasks" description="Manage and view your actionable items" />

      {/* スコープ情報バー */}
      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
        <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-[10px] text-foreground-lighter border border-border">
          {filterDesc}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {loading ? "Loading..." : `${tiles.length} items found`}
        </span>
      </div>

      <div className="mt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {!loading && tiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-dashed border-border rounded-lg bg-surface-1">
            <p className="text-sm">No tasks found matching the current filters.</p>
          </div>
        )}
        {!loading && tiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
            {tiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListViewToTile(t)} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
