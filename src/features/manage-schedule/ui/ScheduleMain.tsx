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

  const { tiles, loading } = useTileList({
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
      ? t("panels.schedule.recurringTemplatesHeading")
      : view === "placements"
        ? t("panels.schedule.placementsHeading")
        : t("panels.schedule.upcomingHeading");
  const subtitle =
    view === "recurring"
      ? t("panels.schedule.recurringTemplatesSub")
      : view === "placements"
        ? t("panels.schedule.placementsSub")
        : t("panels.schedule.upcomingSub");

  const placementsCount = placementsState.placements.length;
  const candidatesCount = candidatesState.candidates.length;
  const placementsLoading = placementsState.loading || candidatesState.loading;

  return (
    <PageContainer>
      <PageHeader title={title} description={subtitle} />

      {/* Scope info bar */}
      <div className="mt-2 flex items-center justify-between pb-3 text-xs text-foreground-subtle">
        <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-caption text-foreground-lighter border border-border">
          {view === "recurring"
            ? t("panels.schedule.scheduleViewRecurring")
            : view === "placements"
              ? t("panels.schedule.scheduleViewPlaced")
              : t("panels.schedule.scheduleViewUpcoming")}
        </span>
        <span className="font-mono text-caption text-foreground-lighter">
          {view === "recurring"
            ? recurring.loading
              ? t("panels.schedule.loading")
              : t("panels.schedule.templatesFound", { count: recurring.templates.length })
            : view === "placements"
              ? placementsLoading
                ? t("panels.schedule.loading")
                : t("panels.schedule.placedWaiting", {
                    placed: placementsCount,
                    waiting: candidatesCount,
                  })
              : loading
                ? t("panels.schedule.loading")
                : t("panels.schedule.itemsFound", { count: filteredTiles.length })}
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
          <Alert
            icon={<AlertCircle className="size-4" />}
            title={t("panels.schedule.recurringErrorTitle")}
          >
            {recurring.error.message}
          </Alert>
        )}
        {view === "placements" && placementsState.error && (
          <Alert
            icon={<AlertCircle className="size-4" />}
            title={t("panels.schedule.placementsErrorTitle")}
          >
            {placementsState.error.message}
          </Alert>
        )}
        {view === "recurring" && !recurring.loading && recurring.templates.length === 0 && (
          <Alert
            icon={<AlertCircle className="size-4" />}
            title={t("panels.schedule.noRecurringTemplatesTitle")}
          >
            <p className="text-sm">{t("panels.schedule.noRecurringTemplatesBody")}</p>
          </Alert>
        )}
        {view !== "recurring" &&
          view !== "placements" &&
          !loading &&
          filteredTiles.length === 0 && (
            <Alert
              icon={<AlertCircle className="size-4" />}
              title={t("panels.schedule.noTilesTitle")}
            >
              <p className="text-sm">{t("panels.schedule.noTilesBody")}</p>
            </Alert>
          )}
        {view === "placements" &&
          !placementsLoading &&
          placementsCount === 0 &&
          candidatesCount === 0 && (
            <Alert
              icon={<AlertCircle className="size-4" />}
              title={t("panels.schedule.noPlacementsTitle")}
            >
              <p className="text-sm">{t("panels.schedule.noPlacementsBody")}</p>
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
                    {t("panels.schedule.placed", { count: placementsCount })}
                  </h2>
                  <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
                    {placementsState.placements.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-foreground-subtle">
                            {t("panels.schedule.workLabel")} {p.work_tile_id.slice(0, 8)}
                          </div>
                          <div className="font-mono text-xs text-foreground-subtle">
                            {t("panels.schedule.blockLabel")} {p.time_tile_id.slice(0, 8)}
                          </div>
                        </div>
                        <span className="rounded bg-surface-3/50 border border-border px-1.5 py-0.5 text-caption font-semibold uppercase tracking-wide text-foreground-subtle shrink-0">
                          {t("panels.schedule.placedMinutes", { minutes: p.planned_minutes })}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {candidatesCount > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2">
                    {t("panels.schedule.waiting", { count: candidatesCount })}
                  </h2>
                  <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
                    {candidatesState.candidates.map((c) => (
                      <div
                        key={c.work_tile_id}
                        className="px-4 py-3 font-mono text-xs text-foreground-subtle"
                      >
                        {t("panels.schedule.workLabel")} {c.work_tile_id.slice(0, 8)}
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
                    <span className="rounded bg-surface-3/50 border border-border px-1.5 py-0.5 text-caption font-semibold uppercase tracking-wide text-foreground-subtle shrink-0">
                      {t("panels.schedule.templateBadge")}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-caption text-foreground-subtle">
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
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-3/50 border-border",
                      )}
                    >
                      {template.recurrence.selector.expression
                        ? t("panels.schedule.selectorEnabled")
                        : t("panels.schedule.selectorNone")}
                    </span>
                  </div>
                </Button>
              ))}
          </div>
        )}

        {/* Upcoming deadlines list matching compact style */}
        {view !== "recurring" && !loading && filteredTiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
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
  if (!generator) return t("panels.schedule.generatorRecurring");
  const phases = generator.focus_block_based?.phases;
  if (phases && phases.length > 0) {
    return t("panels.schedule.generatorPhasesCount", { count: phases.length });
  }
  if (typeof generator.step_min === "number") {
    return t("panels.schedule.generatorStepInterval", { step: generator.step_min });
  }
  return t("panels.schedule.generatorRecurring");
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
