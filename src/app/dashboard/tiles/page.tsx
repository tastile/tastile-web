"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { TimelineAxis } from "@/components/execution/TimelineAxis";
import { DeleteTileDialog } from "@/components/tiles/dialogs/DeleteTileDialog";
import { LoadingCard } from "@/components/tiles/shared/LoadingCard";
import { TileStatusIcon } from "@/components/tiles/shared/TileStatusIcon";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { TileCardExpandable } from "@/components/tiles/TileCardExpandable";
import { Dropdown } from "@/components/ui/Dropdown";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  buildTileChanges,
  buildTileListSections,
  buildTimelineView,
  nextTileSectionLimit,
  parseCustomRangeBoundary,
} from "@/lib/core/dashboard-workspace";
import { Actor } from "@/lib/domain/actor";
import { TileId } from "@/lib/domain/ids";
import { getTileLifecycle, type Tile } from "@/lib/domain/tile";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useTranslation } from "@/lib/i18n/use-translation";
// TODO(new-shell): wire to new component
import { useDialogStore } from "@/lib/stores/dialog-store";
import type { Locale } from "@/lib/stores/locale-store";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";
import { formatDateTime, formatDuration } from "@/lib/utils/tile-formatters";

const MAX_VISIBLE_TILES = 60;
const MAX_VISIBLE_CHANGES = 120;

export default function TilesPage() {
  return (
    <Suspense fallback={<TilesPageLoading />}>
      <TilesPageInner />
    </Suspense>
  );
}

function TilesPageInner() {
  const { state, loading, execute } = useExecutionEngineContext();
  const { openDeleteDialog } = useDialogStore();
  const { t, locale } = useTranslation();
  const [sectionLimitById, setSectionLimitById] = useState<Record<string, number>>({});
  const projection = useMemo(() => buildDashboardProjectionPlaceholder(state), [state]);
  const searchParams = useSearchParams();
  const {
    timelineScale,
    customStartIso,
    customEndIso,
    setTimelineScale,
    setCustomRange,
    activeTilesTab,
    setActiveTilesTab,
    listGroupingMode,
    setListGroupingMode,
    listViewMode,
    setListViewMode,
  } = useDashboardWorkspaceStorePlaceholder();

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRange, setFilterRange] = useState<"all" | "today" | "recent" | "exclude_future">(
    "all",
  );
  const [filterGranularity, setFilterGranularity] = useState<
    "all" | "no_breaks" | "min_5m" | "min_15m" | "min_30m"
  >("min_5m"); // Default to min 5m to hide tiny breaks
  const [filterLimit, setFilterLimit] = useState<number>(50); // Default limit to 50 items

  // Fetch tiles from API using useTileList with query scopes
  const { tiles: apiTiles } = useTileList({
    viewMode: listGroupingMode,
    limit: filterLimit > 0 ? filterLimit : undefined,
    search: searchTerm || undefined,
    range: filterRange,
    granularity: filterGranularity,
  });

  const mappedTiles = useMemo(() => {
    return apiTiles.map(mapListViewToTile);
  }, [apiTiles]);

  // Memoized filtered tiles (no longer filtered client-side, showing everything received from API)
  const filteredTiles = mappedTiles;

  const groupedTiles = useMemo(() => {
    return buildTileListSections(
      filteredTiles,
      state.execution.activeTileId,
      new Date(),
      listGroupingMode,
    );
  }, [filteredTiles, state.execution.activeTileId, listGroupingMode]);

  const timelineView = useMemo(
    () =>
      buildTimelineView(state.timeline, new Date(), {
        scale: timelineScale,
        customStart: parseCustomRangeBoundary(customStartIso, "start"),
        customEnd: parseCustomRangeBoundary(customEndIso, "end"),
      }),
    [state.timeline, timelineScale, customStartIso, customEndIso],
  );

  const titleById = useMemo(
    () => new Map(projection.tiles.ordered.map((tile) => [tile.core.id, tile.core.title] as const)),
    [projection.tiles.ordered],
  );

  const changes = useMemo(
    () => buildTileChanges(state.timeline, titleById).slice(0, MAX_VISIBLE_CHANGES),
    [state.timeline, titleById],
  );

  const sectionSummary = useMemo(() => {
    const openCount = groupedTiles.reduce(
      (sum, group) => sum + (group.id === "log" ? 0 : group.tiles.length),
      0,
    );
    const estimatedMinutes = groupedTiles.reduce(
      (sum, group) =>
        sum +
        group.tiles.reduce(
          (sub, tile) => sub + (tile.objective.targetWorkMin ?? tile.objective.targetRestMin ?? 0),
          0,
        ),
      0,
    );
    return { openCount, estimatedMinutes };
  }, [groupedTiles]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "changes" || requestedTab === "timeline" || requestedTab === "list") {
      setActiveTilesTab(requestedTab);
    }
  }, [searchParams, setActiveTilesTab]);

  function toTileId(tileId: string) {
    return TileId.fromString(tileId);
  }

  async function handlePromptSuggested(tileId: string) {
    await execute(
      {
        type: "request_prompt",
        tile_id: toTileId(tileId),
        requested_at: new Date(),
        reason: "status_icon",
      },
      Actor.human("self"),
    );
  }

  async function handleDelete(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId));
    if (!tile) return;
    openDeleteDialog(tile);
  }

  async function handleDeleteConfirm(tileId: string) {
    await execute(
      {
        type: "delete_tile",
        tile_id: toTileId(tileId),
        deleted_at: new Date(),
      },
      Actor.human("self"),
    );
  }

  if (loading) {
    return <TilesPageLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.tiles.title")}</h1>
        <div className="flex items-center gap-2 rounded-lg bg-surface-1 p-1">
          {(["list", "timeline", "changes"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTilesTab(tab)}
              className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                activeTilesTab === tab
                  ? "bg-surface-2 text-foreground"
                  : "text-foreground-muted hover:bg-surface-2"
              }`}
            >
              {tab === "list"
                ? t("dashboard.tiles.tab.list")
                : tab === "timeline"
                  ? t("dashboard.tiles.tab.timeline")
                  : t("dashboard.tiles.tab.changes")}
            </button>
          ))}
        </div>
      </div>

      {activeTilesTab === "list" ? (
        <div className="space-y-4">
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl bg-surface-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                {t("dashboard.tiles.section.main")}
              </p>
              {projection.next.main ? (
                <DesktopStyleTileRow
                  tile={projection.next.main}
                  locale={locale}
                  onPrompt={handlePromptSuggested}
                />
              ) : (
                <p className="text-sm text-foreground-muted">{t("dashboard.tiles.empty.main")}</p>
              )}
            </div>
            <div className="rounded-xl bg-surface-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                {t("dashboard.tiles.section.sub")}
              </p>
              <div className="space-y-2">
                {projection.next.quick.slice(0, 3).map((tile) => (
                  <DesktopStyleTileRow
                    key={tile.core.id}
                    tile={tile}
                    locale={locale}
                    onPrompt={handlePromptSuggested}
                  />
                ))}
                {projection.next.quick.length === 0 ? (
                  <p className="text-sm text-foreground-muted">{t("dashboard.tiles.empty.sub")}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl bg-surface-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wider text-foreground-muted">
              <span>
                {t("dashboard.tiles.summary.openCount")} {sectionSummary.openCount}
              </span>
              <span>
                {t("dashboard.tiles.summary.estimated")} {sectionSummary.estimatedMinutes}m
              </span>
              <span>
                {t("dashboard.tiles.summary.sections")} {groupedTiles.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("dashboard.tiles.searchPlaceholder")}
                  className="w-full rounded-md bg-surface-0 border border-border px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">
                  {t("dashboard.tiles.filter.rangeLabel")}
                </span>
                <Dropdown
                  value={filterRange}
                  onChange={(val) =>
                    setFilterRange(val as "all" | "today" | "recent" | "exclude_future")
                  }
                  size="tiny"
                  items={[
                    { value: "all", label: t("dashboard.tiles.filter.range.all") },
                    { value: "today", label: t("dashboard.tiles.filter.range.today") },
                    { value: "recent", label: t("dashboard.tiles.filter.range.recent") },
                    { value: "exclude_future", label: t("dashboard.tiles.filter.range.excludeFuture") },
                  ]}
                  className="min-w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">
                  {t("dashboard.tiles.filter.granularityLabel")}
                </span>
                <Dropdown
                  value={filterGranularity}
                  onChange={(val) =>
                    setFilterGranularity(
                      val as "all" | "no_breaks" | "min_5m" | "min_15m" | "min_30m",
                    )
                  }
                  size="tiny"
                  items={[
                    { value: "all", label: t("dashboard.tiles.filter.granularity.all") },
                    { value: "no_breaks", label: t("dashboard.tiles.filter.granularity.noBreaks") },
                    { value: "min_5m", label: t("dashboard.tiles.filter.granularity.min5") },
                    { value: "min_15m", label: t("dashboard.tiles.filter.granularity.min15") },
                    { value: "min_30m", label: t("dashboard.tiles.filter.granularity.min30") },
                  ]}
                  className="min-w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">
                  {t("dashboard.tiles.filter.limitLabel")}
                </span>
                <Dropdown
                  value={String(filterLimit)}
                  onChange={(val) => setFilterLimit(Number(val))}
                  size="tiny"
                  items={[
                    { value: "20", label: t("dashboard.tiles.filter.limit.20") },
                    { value: "50", label: t("dashboard.tiles.filter.limit.50") },
                    { value: "100", label: t("dashboard.tiles.filter.limit.100") },
                    { value: "500", label: t("dashboard.tiles.filter.limit.500") },
                    { value: "0", label: t("dashboard.tiles.filter.limit.unlimited") },
                  ]}
                  className="min-w-[100px]"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md bg-surface-0 p-1">
                {(
                  [
                    ["state", "By State"],
                    ["project", "By Project"],
                    ["tag", "By Tag"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setListGroupingMode(mode)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                      listGroupingMode === mode
                        ? "bg-surface-2 text-foreground"
                        : "text-foreground-muted hover:bg-surface-2"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-md bg-surface-0 p-1">
                {(
                  [
                    ["compact", "Compact"],
                    ["comfortable", "Comfortable"],
                    ["detailed", "Detailed"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setListViewMode(mode)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                      listViewMode === mode
                        ? "bg-surface-2 text-foreground"
                        : "text-foreground-muted hover:bg-surface-2"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
          {groupedTiles.map((group) => {
            const sectionLimit = Math.min(sectionLimitById[group.id] ?? 8, MAX_VISIBLE_TILES);
            const visibleTiles = group.tiles.slice(0, sectionLimit);
            const omittedTiles = Math.max(0, group.tiles.length - visibleTiles.length);
            return (
              <section key={group.id} className="rounded-xl bg-surface-1 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setSectionLimitById((prev) => ({
                        ...prev,
                        [group.id]: nextTileSectionLimit(prev[group.id], group.tiles.length),
                      }))
                    }
                    className="text-sm font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground"
                  >
                    {group.label} ({group.tiles.length})
                  </button>
                  <span className="text-xs font-mono text-foreground-muted">
                    {group.tiles.reduce(
                      (sum, tile) =>
                        sum + (tile.objective.targetWorkMin ?? tile.objective.targetRestMin ?? 0),
                      0,
                    )}
                    m
                  </span>
                </div>
                <div className="space-y-2">
                  {omittedTiles > 0 ? (
                    <p className="text-xs uppercase tracking-wider text-foreground-muted">
                      {t("dashboard.tiles.omittedMore")} {omittedTiles} ▼
                    </p>
                  ) : null}
                  {visibleTiles.map((tile) => (
                    <div key={tile.core.id} className="rounded-lg bg-surface-0 p-2">
                      {listViewMode === "compact" ? (
                        <TileCardCompact tile={tile} onStart={handlePromptSuggested} />
                      ) : null}
                      {listViewMode === "comfortable" ? (
                        <DesktopStyleTileRow
                          tile={tile}
                          locale={locale}
                          onPrompt={handlePromptSuggested}
                        />
                      ) : null}
                      {listViewMode === "detailed" ? (
                        <TileCardExpandable
                          tile={tile}
                          onStart={handlePromptSuggested}
                          onDelete={handleDelete}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {activeTilesTab === "timeline" ? (
        <section className="rounded-xl bg-surface-1 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
              Timeline
            </h2>
            <Dropdown
              value={timelineScale}
              onChange={(val) => setTimelineScale(val as typeof timelineScale)}
              size="tiny"
              items={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "custom", label: "Custom" },
              ]}
              className="min-w-[100px]"
            />
            {timelineScale === "custom" ? (
              <>
                <input
                  type="date"
                  value={customStartIso ? customStartIso.slice(0, 10) : ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setCustomRange(value || null, customEndIso);
                  }}
                  className="themed-datetime-input rounded-md bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
                <input
                  type="date"
                  value={customEndIso ? customEndIso.slice(0, 10) : ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setCustomRange(customStartIso, value || null);
                  }}
                  className="themed-datetime-input rounded-md bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
              </>
            ) : null}
          </div>
          <TimelineAxis
            blocks={timelineView.blocks}
            markers={timelineView.markers}
            canvasHeightPx={timelineView.canvasHeightPx}
            nowTopPx={timelineView.nowTopPx}
            maxVisibleBlocks={80}
            maxCanvasHeightPx={1200}
          />
        </section>
      ) : null}

      {activeTilesTab === "changes" ? (
        <section className="rounded-xl bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
            Recent Changes
          </h2>
          <div className="space-y-2">
            {changes.map((event) => {
              const changeTz = event.tz ?? null;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-0 px-3 py-2"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${event.eventType.endsWith("_ended") ? "bg-success" : "bg-primary"}`}
                  />
                  <span className="text-sm text-foreground">{event.tileTitle}</span>
                  <span className="text-xs uppercase tracking-wider text-foreground-muted">
                    {event.eventType}
                  </span>
                  <span className="ml-auto text-xs text-foreground-muted">
                    {formatDateTime(event.createdAt, locale, changeTz)}
                  </span>
                </div>
              );
            })}
            {changes.length === 0 ? (
              <p className="text-sm text-foreground-muted">No tile changes yet</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {projection.tiles.ordered.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          No tiles yet. Click the + button to create one.
        </p>
      ) : null}

      <DeleteTileDialog onConfirm={handleDeleteConfirm} />
    </div>
  );
}

function TilesPageLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <LoadingCard key={`loading-${i}`} variant="comfortable" />
        ))}
      </div>
    </div>
  );
}

function DesktopStyleTileRow({
  tile,
  locale,
  onPrompt,
}: {
  tile: Tile;
  locale: Locale;
  onPrompt: (tileId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const lifecycle = getTileLifecycle(tile);
  const startAt =
    tile.core.startedAt ??
    tile.temporal.fixedStart ??
    tile.temporal.activeStart ??
    tile.temporal.releaseAt ??
    tile.work.segments.find((segment) => segment.startAt)?.startAt ??
    null;
  const durationText = resolveDurationText(tile, locale);
  const startText = startAt
    ? formatDateTime(startAt, locale, tile.temporal.tz)
    : tile.temporal.fixedStart
      ? formatDateTime(tile.temporal.fixedStart, locale, tile.temporal.tz)
      : formatDateTime(null, locale, tile.temporal.tz);
  const durationLabel = t("tiles.duration");

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md bg-surface-1 px-3 py-2">
      <TileStatusIcon lifecycle={lifecycle} size={18} onClick={() => void onPrompt(tile.core.id)} />
      <div className="min-w-0">
        <p
          className={`truncate text-sm ${lifecycle === "done" ? "text-foreground-muted line-through" : "text-foreground"}`}
        >
          {tile.core.title}
        </p>
        {tile.core.nextAction ? (
          <p className="truncate text-xs text-foreground-muted">{tile.core.nextAction}</p>
        ) : null}
      </div>
      <div className="text-right text-xs text-foreground-muted">
        <p className="font-mono">
          {durationLabel} {durationText}
        </p>
        <p>
          {t("tiles.startAt")} {startText}
        </p>
      </div>
    </div>
  );
}

function resolveDurationText(tile: Tile, locale: Locale): string {
  if (typeof tile.objective.targetWorkMin === "number" && tile.objective.targetWorkMin > 0) {
    return formatDuration(tile.objective.targetWorkMin, locale);
  }
  if (typeof tile.objective.targetRestMin === "number" && tile.objective.targetRestMin > 0) {
    return formatDuration(tile.objective.targetRestMin, locale);
  }
  const totalWorked = tile.work.segments.reduce((sum, segment) => {
    if (!segment.endAt) return sum;
    const diff = Math.max(
      0,
      Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000),
    );
    return sum + diff;
  }, 0);
  if (totalWorked > 0) return formatDuration(totalWorked, locale);
  return formatDuration(null, locale);
}

// TODO(new-shell): wire to new component
function buildDashboardProjectionPlaceholder(state: import("@/lib/core/state").AppState) {
  return {
    next: {
      main: null as import("@/lib/domain/tile").Tile | null,
      quick: [] as import("@/lib/domain/tile").Tile[],
    },
    tiles: {
      ordered: Array.from(state.tiles.values()) as import("@/lib/domain/tile").Tile[],
      ready: [] as import("@/lib/domain/tile").Tile[],
      started: [] as import("@/lib/domain/tile").Tile[],
      done: [] as import("@/lib/domain/tile").Tile[],
    },
  };
}

function useDashboardWorkspaceStorePlaceholder() {
  const [timelineScale, setTimelineScale] = useState<"day" | "week" | "month" | "custom">("day");
  const [customStartIso, setCustomStartIso] = useState<string | null>(null);
  const [customEndIso, setCustomEndIso] = useState<string | null>(null);
  const [activeTilesTab, setActiveTilesTab] = useState<"list" | "timeline" | "changes">("list");
  const [listGroupingMode, setListGroupingMode] = useState<"state" | "project" | "tag">("state");
  const [listViewMode, setListViewMode] = useState<"compact" | "comfortable" | "detailed">(
    "comfortable",
  );
  function setCustomRange(start: string | null, end: string | null) {
    setCustomStartIso(start);
    setCustomEndIso(end);
  }
  return {
    timelineScale,
    customStartIso,
    customEndIso,
    setTimelineScale,
    setCustomRange,
    activeTilesTab,
    setActiveTilesTab,
    listGroupingMode,
    setListGroupingMode,
    listViewMode,
    setListViewMode,
  };
}
