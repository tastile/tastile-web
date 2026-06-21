"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";
import { useDialogStore } from "@/lib/stores/dialog-store";
import { RecurringTileConfigDialog } from "@/components/tiles/dialogs/RecurringTileConfigDialog";

export function ScheduleMain() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "recurring";
  const { openRecurringDialog } = useDialogStore();

  const { tiles, loading } = useTileList({
    viewMode: view === "recurring" ? "recurring" : "by_state",
    limit: view === "recurring" ? undefined : 500,
  });

  const filteredTiles = useMemo(() => {
    if (view === "recurring") {
      // Server already filters templates and sorts them naturally
      return tiles;
    }
    if (view === "upcoming") {
      return tiles.filter((t) => t.temporal?.due_at).sort((a, b) => {
        return new Date(a.temporal!.due_at!).getTime() - new Date(b.temporal!.due_at!).getTime();
      });
    }
    return tiles;
  }, [tiles, view]);

  const title = view === "recurring" ? "Recurring Tiles" : "Upcoming Deadlines";
  const subtitle = view === "recurring" ? "Routines and repeating tasks" : "Tasks with upcoming due dates";

  return (
    <PageContainer>
      <PageHeader title={title} description={subtitle} />
      <div className="flex flex-col gap-2 pt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No tiles found for this schedule view.</p>
          </div>
        )}
        {!loading &&
          filteredTiles.map((t) => (
            <TileCardCompact
              key={t.id}
              tile={mapListViewToTile(t)}
              onEdit={view === "recurring" ? () => openRecurringDialog(t.id) : undefined}
            />
          ))}
      </div>
      <RecurringTileConfigDialog />
    </PageContainer>
  );
}
