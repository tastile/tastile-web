"use client";

import { useCandidates, usePlacements } from "@/shared/hooks/use-placements";
import { useRecurringTemplates } from "@/shared/hooks/use-recurring-templates";
import { useTileList } from "@/shared/hooks/use-tile-list";
import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import { mapListView } from "@/shared/lib/map-list-view-to-tile";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { TileCardCompact } from "@/tile/ui/TileCardCompact";
import { Alert, Button, Skeleton } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function ScheduleMain() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const view = searchParams.get("view") ?? "recurring";
  const ownerIdsFromUrl = (() => {
    const raw = searchParams.get("projects");
    if (!raw) return undefined;
    return raw.split(",").filter(Boolean);
  })();
  const recurring = useRecurringTemplates();
  const placementsState = usePlacements();
  const candidatesState = useCandidates();
  const openCreate = useQuickCreateStore((s) => s.openCreate);

  const { tiles, loading, error: tileError, refresh: refreshTiles } = useTileList({
    viewMode: view === "recurring" ? "recurring" : "by_state",
    limit: view === "recurring" ? undefined : 500,
    range: "7d",
    granularity: "no_breaks,min_0m",
    ownerIds: ownerIdsFromUrl,
  });

  const filteredTiles = (() => {
    if (view === "upcoming") {
      return tiles
        .filter(
          (t): t is typeof t & { temporal: { due_at: string } } =>
            typeof t.temporal?.due_at === "string",
        )
        .sort((a, b) => {
          return new Date(a.temporal.due_at).getTime() - new Date(b.temporal.due_at).getTime();
        });
    }
    return tiles;
  })();

  const title =
    view === "recurring"
      ? t("schedule.recurringTitle")
      : view === "placements"
        ? t("schedule.placementsTitle")
        : t("schedule.upcomingTitle");
  const subtitle =
    view === "recurring"
      ? t("schedule.recurringSubtitle")
      : view === "placements"
        ? t("schedule.placementsSubtitle")
        : t("schedule.upcomingSubtitle");

  const placementsCount = placementsState.placements.length;
  const candidatesCount = candidatesState.candidates.length;
  const placementsLoading = placementsState.loading || candidatesState.loading;
  const refreshPlacements = async () => {
    await Promise.all([placementsState.refresh(), candidatesState.refresh()]);
  };
  const scopeLabel =
    view === "recurring"
      ? t("schedule.recurringView")
      : view === "placements"
        ? t("schedule.placementsView")
        : t("schedule.upcomingView");

  return (
    <PageContainer>
      <PageHeader title={title} description={subtitle} />

      {/* Scope info bar */}
      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
        <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-[10px] text-foreground-lighter border border-border">
          {scopeLabel}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {view === "recurring"
            ? recurring.loading
              ? t("schedule.loading")
              : t("schedule.templatesCount", { count: recurring.templates.length })
            : view === "placements"
              ? placementsLoading
                ? t("schedule.loading")
                : t("schedule.placementSummary", {
                    placed: placementsCount,
                    waiting: candidatesCount,
                  })
              : loading
                ? t("schedule.loading")
                : t("schedule.itemsCount", { count: filteredTiles.length })}
        </span>
      </div>

      <div className="mt-4">
        {view === "recurring" && recurring.loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        )}
        {view !== "recurring" && view !== "placements" && loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}
        {view === "placements" && placementsLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}
        {view === "recurring" && recurring.error && (
          <Alert
            radius="sm"
            icon={<AlertCircle className="h-4 w-4" />}
            title={t("schedule.failedTemplates")}
          >
            <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => void recurring.refresh()}>
              {t("schedule.retry")}
            </Button>
          </Alert>
        )}
        {view === "placements" && (placementsState.error || candidatesState.error) && (
          <Alert radius="sm" icon={<AlertCircle className="h-4 w-4" />} title={t("schedule.failedPlacements")}>
            <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => void refreshPlacements()}>
              {t("schedule.retry")}
            </Button>
          </Alert>
        )}
        {view !== "recurring" && view !== "placements" && tileError && !loading && (
          <Alert radius="sm" icon={<AlertCircle className="h-4 w-4" />} title={t("schedule.failedItems")}>
            <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => void refreshTiles()}>
              {t("schedule.retry")}
            </Button>
          </Alert>
        )}
        {view === "recurring" && !recurring.loading && !recurring.error && recurring.templates.length === 0 && (
          <Alert radius="sm" icon={<AlertCircle className="h-4 w-4" />} title={t("schedule.noTemplatesTitle")}>
            <p className="text-sm">{t("schedule.noTemplatesBody")}</p>
            <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => openCreate()}>
              {t("schedule.createWorkflow")}
            </Button>
          </Alert>
        )}
        {view !== "recurring" &&
          view !== "placements" &&
          !loading &&
          !tileError &&
          filteredTiles.length === 0 && (
            <Alert radius="sm" icon={<AlertCircle className="h-4 w-4" />} title={t("schedule.noItemsTitle")}>
              <p className="text-sm">{t("schedule.noItemsBody")}</p>
              <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => openCreate()}>
                {t("schedule.createWorkflow")}
              </Button>
            </Alert>
          )}
        {view === "placements" &&
          !placementsLoading &&
          !placementsState.error &&
          !candidatesState.error &&
          placementsCount === 0 &&
          candidatesCount === 0 && (
            <Alert radius="sm" icon={<AlertCircle className="h-4 w-4" />} title={t("schedule.noPlacementsTitle")}>
              <p className="text-sm">{t("schedule.noPlacementsBody")}</p>
                <Button size="xs" radius="sm" variant="light" mt="sm" onClick={() => openCreate()}>
                {t("schedule.createWorkflow")}
              </Button>
            </Alert>
          )}

        {/* Placements + candidates view */}
        {view === "placements" &&
          !placementsLoading &&
          (placementsCount > 0 || candidatesCount > 0) && (
            <div className="flex flex-col gap-6">
              {placementsCount > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2">
                    {t("schedule.placed")} ({placementsCount})
                  </h2>
                  <div className="border border-border bg-surface-1 rounded-md overflow-hidden divide-y divide-border/40 shadow-xs">
                    {placementsState.placements.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-foreground-subtle">
                            {t("schedule.work")} · {p.work_tile_id.slice(0, 8)}
                          </div>
                          <div className="font-mono text-xs text-foreground-subtle">
                            {t("schedule.timeBlock")} · {p.time_tile_id.slice(0, 8)}
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
                    {t("schedule.waiting")} ({candidatesCount})
                  </h2>
                  <div className="border border-border bg-surface-1 rounded-md overflow-hidden divide-y divide-border/40 shadow-xs">
                    {candidatesState.candidates.map((c) => (
                      <div
                        key={c.work_tile_id}
                        className="px-4 py-3 font-mono text-xs text-foreground-subtle"
                      >
                        {t("schedule.work")} · {c.work_tile_id.slice(0, 8)}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

        {/* Recurring templates list as a table */}
        {view === "recurring" && !recurring.loading && recurring.templates.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-md overflow-hidden divide-y divide-border/40 shadow-xs">
            {recurring.templates
              .reduce<typeof recurring.templates>((acc, t) => {
                if (t?.recurrence) acc.push(t);
                return acc;
              }, [])
              .map((template) => (
                <Button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    const { loadFromTemplate } = useQuickCreateStore.getState();
                    loadFromTemplate(template);
                  }}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-surface-2 flex flex-col gap-1.5 cursor-pointer"
                  radius="sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {template.title}
                      </div>
                      {template.note ? (
                        <div className="mt-0.5 text-xs text-foreground-subtle truncate">
                          {template.note}
                        </div>
                      ) : null}
                    </div>
                    <span className="rounded bg-surface-3/50 border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground-subtle shrink-0">
                      {t("schedule.template")}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-foreground-subtle">
                    <span className="rounded bg-surface-3/50 px-1.5 py-0.5 border border-border">
                      {describeGenerator(template, t)}
                    </span>
                    <span className="rounded bg-surface-3/50 px-1.5 py-0.5 border border-border">
                      {formatWindow(
                        template.recurrence.window.start_offset_min,
                        template.recurrence.window.end_offset_min,
                      )}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 border",
                        template.recurrence.selector.expression
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-surface-3/50 border-border",
                      )}
                    >
                      {template.recurrence.selector.expression
                        ? t("schedule.selectorEnabled")
                        : t("schedule.noSelector")}
                    </span>
                  </div>
                </Button>
              ))}
          </div>
        )}

        {/* Upcoming deadlines list matching compact style */}
        {view !== "recurring" && !loading && filteredTiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-md overflow-hidden divide-y divide-border/40 shadow-xs">
            {filteredTiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListView(t)} listView={t} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function describeGenerator(
  template: ReturnType<typeof useRecurringTemplates>["templates"][number],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const generator = template?.recurrence?.generator;
  if (!generator) return t("schedule.noGenerator");
  const phases = generator.focus_block_based?.phases;
  if (phases && phases.length > 0) {
    return t("schedule.phases", { count: phases.length });
  }
  if (typeof generator.step_min === "number") {
    return t("schedule.everyMinutes", { minutes: generator.step_min });
  }
  return t("schedule.noGenerator");
}

function formatWindow(startOffsetMin: number, endOffsetMin: number) {
  return `${formatMinutes(startOffsetMin)}-${formatMinutes(endOffsetMin)}`;
}

function formatMinutes(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
