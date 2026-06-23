"use client";

import { useMemo } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

export function ReferencesMain() {
  const { enabled } = useReferenceOverlayStore();
  const { tiles, loading } = useTileList({
    viewMode: "by_state",
    limit: 500,
  });

  const filteredTiles = useMemo(() => {
    if (enabled.length === 0) return [];
    return tiles.filter((t) => t.labels?.some((l) => enabled.includes(l)));
  }, [tiles, enabled]);

  return (
    <PageContainer>
      <PageHeader
        title="References"
        description={
          enabled.length > 0
            ? `Showing tiles for ${enabled.length} selected labels`
            : "Select labels from the sidebar to view references"
        }
      />
      <div className="flex flex-col gap-2 pt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && enabled.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No reference labels selected.</p>
          </div>
        )}
        {!loading && enabled.length > 0 && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No tiles found matching the selected labels.</p>
          </div>
        )}
        {!loading &&
          filteredTiles.map((t) => <TileCardCompact key={t.id} tile={mapListViewToTile(t)} />)}
      </div>
    </PageContainer>
  );
}
