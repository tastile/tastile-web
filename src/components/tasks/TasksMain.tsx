"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { makeClient } from "@/lib/api/v1/submit";
import { startTileExecutionCommand } from "@/lib/api/v1/tile-commands";
import type { TileId } from "@/lib/domain/ids";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useTileEditStore } from "@/lib/stores/tile-edit-store";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

export function TasksMain() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const range = searchParams.get("range") ?? "7d"; // デフォルト7日
  const granularity = searchParams.get("granularity") ?? "no_breaks,min_0m";
  const openEdit = useTileEditStore((s) => s.openEdit);
  const [startingTileId, setStartingTileId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const { tiles, loading, refresh } = useTileList({
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

  const handleStart = useCallback(async (tileId: TileId) => {
    const id = tileId.toString();
    const item = tiles.find((tile) => tile.id === id);
    if (!item?.plan_id) {
      setStartError("This tile has no plan_id; start command cannot be sent.");
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + resolveStartDurationMs(item));
    setStartingTileId(id);
    setStartError(null);

    const result = await startTileExecutionCommand({
      client: makeClient(),
      tileId: id,
      planId: item.plan_id,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    setStartingTileId(null);
    if (!result.ok) {
      setStartError(result.error.message);
      return;
    }

    window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
    await refresh();
  }, [tiles, refresh]);

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
      {startError ? (
        <div className="mt-3 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {startError}
        </div>
      ) : null}

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
            {tiles.map((t) => {
              const tile = mapListViewToTile(t);
              return (
                <TileCardCompact
                  key={t.id}
                  tile={tile}
                  onStart={startingTileId === t.id ? undefined : handleStart}
                  onEdit={(tileId) =>
                    openEdit(
                      tileId.toString(),
                      tile.core.title,
                      "",
                      "",
                      t.labels,
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function resolveStartDurationMs(item: { target_work_min: number | null; target_rest_min: number | null }): number {
  const minutes = item.target_work_min ?? item.target_rest_min ?? 25;
  return Math.max(1, minutes) * 60_000;
}
