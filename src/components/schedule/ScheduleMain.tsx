"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useRecurringTemplates } from "@/lib/hooks/use-recurring-templates";
import { usePlacements, useCandidates } from "@/lib/hooks/use-placements";
import { useDialogStore } from "@/lib/stores/dialog-store";
import { RecurringTileConfigDialog } from "@/components/tiles/dialogs/RecurringTileConfigDialog";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";
import { cn } from "@/lib/utils/cn";

export function ScheduleMain() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "recurring";
  const { openRecurringDialog } = useDialogStore();
  const recurring = useRecurringTemplates();
  const placementsState = usePlacements();
  const candidatesState = useCandidates();

  const { tiles, loading } = useTileList({
    viewMode: view === "recurring" ? "recurring" : "by_state",
    limit: view === "recurring" ? undefined : 500,
    range: "7d",
    granularity: "no_breaks,min_0m",
  });

  const filteredTiles = useMemo(() => {
    if (view === "upcoming") {
      return tiles.filter((t) => t.temporal?.due_at).sort((a, b) => {
        return new Date(a.temporal!.due_at!).getTime() - new Date(b.temporal!.due_at!).getTime();
      });
    }
    return tiles;
  }, [tiles, view]);

  const title =
    view === "recurring"
      ? "Recurring Tiles"
      : view === "placements"
        ? "Auto-Placed Schedule"
        : "Upcoming Deadlines";
  const subtitle =
    view === "recurring"
      ? "Routines and repeating tasks"
      : view === "placements"
        ? "Work tiles the engine has placed into time blocks"
        : "Tasks with upcoming due dates";

  const placementsCount = placementsState.placements.length;
  const candidatesCount = candidatesState.candidates.length;
  const placementsLoading = placementsState.loading || candidatesState.loading;

  return (
    <PageContainer>
      <PageHeader title={title} description={subtitle} />

      {/* スコープ情報バー */}
      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
        <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-[10px] text-foreground-lighter border border-border">
          {view === "recurring"
            ? "Schedule View: Recurring Templates"
            : view === "placements"
              ? "Schedule View: Auto-Placed"
              : "Schedule View: Upcoming Deadlines"}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {view === "recurring"
            ? (recurring.loading ? "Loading..." : `${recurring.templates.length} templates found`)
            : view === "placements"
              ? (placementsLoading ? "Loading..." : `${placementsCount} placed · ${candidatesCount} waiting`)
              : (loading ? "Loading..." : `${filteredTiles.length} items found`)}
        </span>
      </div>

      <div className="mt-4">
        {view === "recurring" && recurring.loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}
        {view !== "recurring" && view !== "placements" && loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {view === "placements" && placementsLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {view === "recurring" && recurring.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Failed to load recurring templates: {recurring.error.message}
          </div>
        )}
        {view === "placements" && placementsState.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Failed to load placements: {placementsState.error.message}
          </div>
        )}
        {view === "recurring" && !recurring.loading && recurring.templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-dashed border-border rounded-lg bg-surface-1">
            <p className="text-sm">No recurring templates found in the source database.</p>
          </div>
        )}
        {view !== "recurring" && view !== "placements" && !loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-dashed border-border rounded-lg bg-surface-1">
            <p className="text-sm">No tiles found for this schedule view.</p>
          </div>
        )}
        {view === "placements" && !placementsLoading && placementsCount === 0 && candidatesCount === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-dashed border-border rounded-lg bg-surface-1">
            <p className="text-sm">No placements yet. Create a work tile with an estimated duration to see it scheduled here.</p>
          </div>
        )}
        
        {/* Placements + candidates view */}
        {view === "placements" && !placementsLoading && (placementsCount > 0 || candidatesCount > 0) && (
          <div className="flex flex-col gap-6">
            {placementsCount > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2">
                  Placed ({placementsCount})
                </h2>
                <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
                  {placementsState.placements.map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-foreground-subtle">
                          work {p.work_tile_id.slice(0, 8)}
                        </div>
                        <div className="font-mono text-xs text-foreground-subtle">
                          block {p.time_tile_id.slice(0, 8)}
                        </div>
                      </div>
                      <span className="rounded bg-surface-3/50 border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle shrink-0">
                        {p.planned_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {candidatesCount > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2">
                  Waiting ({candidatesCount})
                </h2>
                <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
                  {candidatesState.candidates.map((c) => (
                    <div
                      key={c.work_tile_id}
                      className="px-4 py-3 font-mono text-xs text-foreground-subtle"
                    >
                      work {c.work_tile_id.slice(0, 8)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Recurring templates list as a table */}
        {view === "recurring" && !recurring.loading && recurring.templates.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
            {recurring.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => openRecurringDialog(template.id)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-surface-2 flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{template.title}</div>
                    {template.note ? (
                      <div className="mt-0.5 text-xs text-foreground-subtle truncate">{template.note}</div>
                    ) : null}
                  </div>
                  <span className="rounded bg-surface-3/50 border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground-subtle shrink-0">
                    Template
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-foreground-subtle">
                  <span className="rounded bg-surface-3/50 px-1.5 py-0.5 border border-border">
                    {describeGenerator(template)}
                  </span>
                  <span className="rounded bg-surface-3/50 px-1.5 py-0.5 border border-border">
                    {formatWindow(template.recurrence.window.start_offset_min, template.recurrence.window.end_offset_min)}
                  </span>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 border",
                    template.recurrence.selector.expression ? "bg-primary/10 text-primary border-primary/20" : "bg-surface-3/50 border-border",
                  )}>
                    {template.recurrence.selector.expression ? "Selector enabled" : "No selector"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Upcoming deadlines list matching compact style */}
        {view !== "recurring" && !loading && filteredTiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
            {filteredTiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListViewToTile(t)} />
            ))}
          </div>
        )}
      </div>
      <RecurringTileConfigDialog />
    </PageContainer>
  );
}

function describeGenerator(template: ReturnType<typeof useRecurringTemplates>["templates"][number]) {
  const phases = template.recurrence.generator.focus_block_based?.phases;
  if (phases && phases.length > 0) {
    return `${phases.length} phases`;
  }
  if (typeof template.recurrence.generator.step_min === "number") {
    return `Every ${template.recurrence.generator.step_min} min`;
  }
  return "Recurring";
}

function formatWindow(startOffsetMin: number, endOffsetMin: number) {
  return `${formatMinutes(startOffsetMin)}-${formatMinutes(endOffsetMin)}`;
}

function formatMinutes(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
