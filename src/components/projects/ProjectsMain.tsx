"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useProjectsStore } from "@/lib/stores/projects-store";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

export function ProjectsMain() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  
  const { projects } = useProjectsStore();
  const project = projectId ? projects[projectId] : null;

  const { tiles, loading } = useTileList({
    viewMode: "by_state",
    limit: 500,
  });

  const filteredTiles = useMemo(() => {
    let filtered = tiles;
    if (project && project.labelFilter.length > 0) {
      filtered = filtered.filter((t) =>
        t.labels?.some((l) => project.labelFilter.includes(l))
      );
    }
    return filtered;
  }, [tiles, project]);

  return (
    <PageContainer>
      <PageHeader
        title={project ? project.name : "All Projects"}
        description={project ? "Manage tiles in this project" : "Select a project from the sidebar"}
      />
      <div className="flex flex-col gap-2 pt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No tiles match this project&apos;s filters.</p>
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
