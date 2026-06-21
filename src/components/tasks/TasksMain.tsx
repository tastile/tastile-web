"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList, type TileListView } from "@/lib/hooks/use-tile-list";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

function dueBucket(tile: TileListView): string {
  if (tile.lifecycle === "done" || tile.lifecycle === "closed") return "Closed";
  const dueStr = tile.temporal?.due_at;
  if (!dueStr) return "No date";
  const due = new Date(dueStr);
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

export function TasksMain() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const bucketFilter = searchParams.get("bucket") ?? "All";

  const { tiles, loading } = useTileList({
    viewMode: "by_state",
    limit: 200,
    search: search || undefined,
    granularity: "no_breaks",
  });

  const filteredTiles = useMemo(() => {
    let filtered = tiles;
    if (bucketFilter !== "All") {
      filtered = filtered.filter((t) => dueBucket(t) === bucketFilter);
    }
    return filtered;
  }, [tiles, bucketFilter]);

  return (
    <PageContainer>
      <PageHeader
        title={bucketFilter === "All" ? "All Tasks" : `${bucketFilter} Tasks`}
        description="Manage and view your actionable items"
      />
      <div className="flex flex-col gap-2 pt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No tasks found in this bucket.</p>
          </div>
        )}
        {!loading &&
          filteredTiles.map((t) => (
            <TileCardCompact key={t.id} tile={mapListViewToTile(t)} />
          ))}
      </div>
    </PageContainer>
  );
}
