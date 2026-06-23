"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
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
    range: "7d",
    granularity: "no_breaks,min_0m",
  });

  const filteredTiles = useMemo(() => {
    let filtered = tiles;
    if (project && project.labelFilter.length > 0) {
      filtered = filtered.filter((t) => t.labels?.some((l) => project.labelFilter.includes(l)));
    }
    return filtered;
  }, [tiles, project]);

  return (
    <PageContainer>
      <PageHeader
        title={project ? project.name : "All Projects"}
        description={project ? "Manage tiles in this project" : "Select a project from the sidebar"}
      />

      {/* スコープ情報バー */}
      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
        <span className="flex items-center gap-2 font-mono bg-surface-2 px-2 py-0.5 rounded text-[10px] text-foreground-lighter border border-border">
          {project ? (
            <>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              Labels: {project.labelFilter.map((l) => `#${l}`).join(", ")}
            </>
          ) : (
            "All project tiles"
          )}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {loading ? "Loading..." : `${filteredTiles.length} items found`}
        </span>
      </div>

      <div className="mt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {!loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-dashed border-border rounded-lg bg-surface-1">
            <p className="text-sm">No tiles match this project&apos;s filters.</p>
          </div>
        )}
        {!loading && filteredTiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
            {filteredTiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListViewToTile(t)} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
