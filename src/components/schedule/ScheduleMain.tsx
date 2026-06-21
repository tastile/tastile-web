"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useRecurringTemplates } from "@/lib/hooks/use-recurring-templates";
import { useDialogStore } from "@/lib/stores/dialog-store";
import { RecurringTileConfigDialog } from "@/components/tiles/dialogs/RecurringTileConfigDialog";
import { cn } from "@/lib/utils/cn";

export function ScheduleMain() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "recurring";
  const { openRecurringDialog } = useDialogStore();
  const recurring = useRecurringTemplates();

  const { tiles, loading } = useTileList({
    viewMode: view === "recurring" ? "recurring" : "by_state",
    limit: view === "recurring" ? undefined : 500,
  });

  const filteredTiles = useMemo(() => {
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
        {view === "recurring" && recurring.loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}
        {view !== "recurring" && loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {view === "recurring" && recurring.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Failed to load recurring templates: {recurring.error.message}
          </div>
        )}
        {view === "recurring" && !recurring.loading && recurring.templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No recurring templates found in the source database.</p>
          </div>
        )}
        {view !== "recurring" && !loading && filteredTiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle">
            <p className="text-sm">No tiles found for this schedule view.</p>
          </div>
        )}
        {view === "recurring" &&
          !recurring.loading &&
          recurring.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => openRecurringDialog(template.id)}
              className="rounded-xl border border-border bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{template.title}</div>
                  {template.note ? (
                    <div className="mt-1 text-xs text-foreground-subtle">{template.note}</div>
                  ) : null}
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
                  Template
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground-subtle">
                <span className="rounded-md bg-surface-2 px-2 py-1">
                  {describeGenerator(template)}
                </span>
                <span className="rounded-md bg-surface-2 px-2 py-1">
                  {formatWindow(template.recurrence.window.start_offset_min, template.recurrence.window.end_offset_min)}
                </span>
                <span className={cn(
                  "rounded-md px-2 py-1",
                  template.recurrence.selector.expression ? "bg-surface-2" : "bg-surface-0 border border-border",
                )}>
                  {template.recurrence.selector.expression ? "Selector enabled" : "No selector"}
                </span>
              </div>
            </button>
          ))}
        {view !== "recurring" &&
          filteredTiles.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface-1 p-4">
              <div className="text-sm font-medium text-foreground">{t.title}</div>
              <div className="mt-1 text-xs text-foreground-subtle">
                {t.temporal?.due_at ? new Date(t.temporal.due_at).toLocaleString() : "No due date"}
              </div>
            </div>
          ))}
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
