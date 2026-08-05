import type { TileId } from "@/shared/model/ids";
import { type Tile, getTileLifecycle } from "@/tile/model/tile";
import type { TimelineSnapshot } from "./execution";

type TimelineScale = "day" | "week" | "month" | "custom";

export interface TimelineWindowInput {
  scale: TimelineScale;
  customStart: Date | null;
  customEnd: Date | null;
}

export interface TimelineView {
  windowStart: Date;
  windowEnd: Date;
  markers: Array<{
    label: string;
    topPx: number;
  }>;
  canvasHeightPx: number;
  nowTopPx: number | null;
  blocks: Array<{
    id: string;
    title: string;
    type: "work" | "break" | "fixed";
    status: "done" | "active" | "scheduled";
    topPx: number;
    heightPx: number;
    lane: number;
    totalLanes: number;
    startLabel: string;
    endLabel: string;
    durationLabel: string;
    dateLabel: string;
    timeLabel: string;
    startAt: Date;
    endAt: Date;
    /** IANA timezone name from the source tile. UI MUST NOT consult the
     *  browser's local timezone. */
    tz: string | null;
  }>;
}

export interface ChangeEvent {
  id: string;
  eventType: string;
  tileTitle: string;
  createdAt: Date;
  tileId: TileId | null;
  /** IANA timezone name from the source tile. UI MUST NOT consult the
   *  browser's local timezone when rendering. */
  tz?: string | null;
}

export interface WorkspaceGroup {
  id: "focus" | "ready" | "scheduled" | "recent" | "log";
  label: string;
  tiles: Tile[];
}

export type ListGroupingMode = "state" | "project" | "tag";

export interface ListSection {
  id: string;
  label: string;
  tiles: Tile[];
}

const MIN_BLOCK_HEIGHT = 44;
const DEFAULT_TIMELINE_DURATION_MIN = 25;
const TILE_SECTION_INITIAL_LIMIT = 8;
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function buildTimelineView(
  timeline: TimelineSnapshot[],
  now: Date,
  input: TimelineWindowInput = {
    scale: "day",
    customStart: null,
    customEnd: null,
  },
): TimelineView {
  const window = resolveTimelineWindow(now, input);
  const pxPerMinuteBase = pixelsPerMinuteForScale(
    input.scale,
    window.windowStart,
    window.windowEnd,
  );
  const pxPerMinute = resolveReadablePxPerMinute(
    timeline,
    window.windowStart,
    window.windowEnd,
    now,
    pxPerMinuteBase,
  );
  const canvasHeightPx = Math.max(
    360,
    minutesBetween(window.windowStart, window.windowEnd) * pxPerMinute,
  );
  const blocks = timeline
    .map((item) => {
      const segmentEnd = resolveTimelineEnd(item, now);
      const clippedStart = new Date(Math.max(item.startAt.getTime(), window.windowStart.getTime()));
      const clippedEnd = new Date(Math.min(segmentEnd.getTime(), window.windowEnd.getTime()));
      if (clippedEnd.getTime() <= clippedStart.getTime()) return null;

      const topPx = minutesBetween(window.windowStart, clippedStart) * pxPerMinute;
      const heightPx = Math.max(
        MIN_BLOCK_HEIGHT,
        minutesBetween(clippedStart, clippedEnd) * pxPerMinute,
      );

      return {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        topPx,
        heightPx,
        lane: 0,
        totalLanes: 1,
        startLabel: formatTime(clippedStart, item.tz),
        endLabel: formatTime(clippedEnd, item.tz),
        durationLabel: formatDuration(clippedStart, clippedEnd),
        dateLabel: formatDate(clippedStart, item.tz),
        timeLabel: formatTime(clippedStart, item.tz),
        startAt: clippedStart,
        endAt: clippedEnd,
        tz: item.tz ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.topPx - b.topPx || b.heightPx - a.heightPx);

  assignLanes(blocks);
  const markers = buildMarkers(window.windowStart, window.windowEnd, pxPerMinute, input.scale);
  const nowTopPx =
    now >= window.windowStart && now <= window.windowEnd
      ? minutesBetween(window.windowStart, now) * pxPerMinute
      : null;

  return {
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    markers,
    canvasHeightPx,
    nowTopPx,
    blocks,
  };
}

function resolveTimelineEnd(item: TimelineSnapshot, now: Date): Date {
  if (item.endAt) return item.endAt;
  if (typeof item.durationMin === "number" && item.durationMin > 0) {
    return new Date(item.startAt.getTime() + item.durationMin * 60 * 1000);
  }
  if (item.status === "active") return now;
  return new Date(item.startAt.getTime() + DEFAULT_TIMELINE_DURATION_MIN * 60 * 1000);
}

function resolveReadablePxPerMinute(
  timeline: TimelineSnapshot[],
  windowStart: Date,
  windowEnd: Date,
  now: Date,
  pxPerMinuteBase: number,
): number {
  let minVisibleDurationMin = Number.POSITIVE_INFINITY;
  for (const item of timeline) {
    const endAt = resolveTimelineEnd(item, now);
    if (endAt.getTime() <= item.startAt.getTime()) continue;
    const clippedStart = new Date(Math.max(item.startAt.getTime(), windowStart.getTime()));
    const clippedEnd = new Date(Math.min(endAt.getTime(), windowEnd.getTime()));
    if (clippedEnd.getTime() <= clippedStart.getTime()) continue;
    const visibleMinutes = minutesBetween(clippedStart, clippedEnd);
    if (visibleMinutes > 0) {
      minVisibleDurationMin = Math.min(minVisibleDurationMin, visibleMinutes);
    }
  }
  if (!Number.isFinite(minVisibleDurationMin)) return pxPerMinuteBase;
  const readablePxPerMinute = MIN_BLOCK_HEIGHT / minVisibleDurationMin;
  const capped = Math.min(readablePxPerMinute, pxPerMinuteBase * 1.35);
  return Math.max(pxPerMinuteBase, capped);
}

export function buildChanges(
  timeline: TimelineSnapshot[],
  titleById: Map<TileId, string>,
): ChangeEvent[] {
  return timeline
    .flatMap((item) => {
      const title = item.tileId ? (titleById.get(item.tileId) ?? item.title) : item.title;
      const starts = {
        id: `${item.id}-start`,
        eventType: `${item.type}_started`,
        tileTitle: title,
        createdAt: item.startAt,
        tileId: item.tileId,
        tz: item.tz ?? null,
      };
      if (!item.endAt) return [starts];
      const ends = {
        id: `${item.id}-end`,
        eventType: `${item.type}_ended`,
        tileTitle: title,
        createdAt: item.endAt,
        tileId: item.tileId,
        tz: item.tz ?? null,
      };
      return [starts, ends];
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function groupForWorkspace(
  tiles: Tile[],
  activeTileId: TileId | null,
  now: Date,
  collapseDoneAfterDays = 14,
): WorkspaceGroup[] {
  const latestByTile = new Map<TileId, number>();
  for (const tile of tiles) {
    const updatedAt = inferUpdatedAt(tile, latestByTile);
    if (updatedAt !== null) {
      latestByTile.set(tile.core.id, updatedAt);
    }
  }

  const groups: Record<WorkspaceGroup["id"], Tile[]> = {
    focus: [],
    ready: [],
    scheduled: [],
    recent: [],
    log: [],
  };

  for (const tile of tiles) {
    const lifecycle = getTileLifecycle(tile);
    if (activeTileId !== null && tile.core.id === activeTileId && lifecycle !== "done") {
      groups.focus.push(tile);
      continue;
    }
    if (lifecycle === "done") {
      const completedAt = tile.core.completedAt?.getTime() ?? 0;
      if (
        completedAt > 0 &&
        now.getTime() - completedAt <= collapseDoneAfterDays * 24 * 60 * 60 * 1000
      ) {
        groups.log.push(tile);
      }
      continue;
    }

    if (lifecycle === "started") {
      groups.recent.push(tile);
      continue;
    }

    const availableAt = inferUpcomingAt(tile);
    if (availableAt && availableAt.getTime() > now.getTime()) {
      groups.scheduled.push(tile);
      continue;
    }

    const updatedAtMs = inferUpdatedAt(tile, latestByTile);
    if (updatedAtMs !== null && now.getTime() - updatedAtMs <= RECENT_WINDOW_MS) {
      groups.recent.push(tile);
      continue;
    }

    const dueLikeAt = inferUpcomingAt(tile);
    if (dueLikeAt !== null && dueLikeAt.getTime() - now.getTime() <= UPCOMING_WINDOW_MS) {
      groups.scheduled.push(tile);
      continue;
    }
    groups.ready.push(tile);
  }

  const byRecentDesc = (a: Tile, b: Tile) => {
    const diff = (inferUpdatedAt(b, latestByTile) ?? 0) - (inferUpdatedAt(a, latestByTile) ?? 0);
    if (diff !== 0) return diff;
    return a.core.title.localeCompare(b.core.title, "en", {
      sensitivity: "base",
    });
  };

  groups.focus.sort(byRecentDesc);
  groups.ready.sort(byRecentDesc);
  groups.scheduled.sort((a, b) => {
    const ad = inferUpcomingAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd = inferUpcomingAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    return byRecentDesc(a, b);
  });
  groups.recent.sort(byRecentDesc);
  groups.log.sort(byRecentDesc);

  const orderedGroups: WorkspaceGroup[] = [
    { id: "focus", label: "Focus", tiles: groups.focus },
    { id: "ready", label: "Ready", tiles: groups.ready },
    { id: "scheduled", label: "Scheduled", tiles: groups.scheduled },
    { id: "recent", label: "Recent Activity", tiles: groups.recent },
    { id: "log", label: "Log", tiles: groups.log },
  ];
  return orderedGroups.filter((group) => group.tiles.length > 0);
}

export function buildListSections(
  tiles: Tile[],
  activeTileId: TileId | null,
  now: Date,
  mode: ListGroupingMode,
): ListSection[] {
  if (mode === "state") {
    const grouped = groupForWorkspace(tiles, activeTileId, now);
    const byId = new Map(grouped.map((group) => [group.id, group]));
    const orderedIds: Array<WorkspaceGroup["id"]> = [
      "focus",
      "ready",
      "scheduled",
      "recent",
      "log",
    ];
    return orderedIds.map((id) => ({
      id,
      label: byId.get(id)?.label ?? fallbackStateLabel(id),
      tiles: byId.get(id)?.tiles ?? [],
    }));
  }
  if (mode === "project") {
    return groupByProject(tiles);
  }
  return groupByTag(tiles);
}

export function nextSectionLimit(currentLimit: number | undefined, itemCount: number): number {
  const current = currentLimit ?? TILE_SECTION_INITIAL_LIMIT;
  if (itemCount <= TILE_SECTION_INITIAL_LIMIT) return TILE_SECTION_INITIAL_LIMIT;
  const next = current * 2;
  return next > itemCount ? TILE_SECTION_INITIAL_LIMIT : next;
}

export function parseCustomRangeBoundary(value: string | null, edge: "start" | "end"): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const normalized = dateOnly
    ? `${trimmed}T${edge === "start" ? "00:00:00" : "23:59:59"}`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveTimelineWindow(
  now: Date,
  input: TimelineWindowInput,
): { windowStart: Date; windowEnd: Date } {
  if (
    input.scale === "custom" &&
    input.customStart &&
    input.customEnd &&
    input.customEnd > input.customStart
  ) {
    return {
      windowStart: new Date(input.customStart),
      windowEnd: new Date(input.customEnd),
    };
  }
  if (input.scale === "week") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 3);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { windowStart: start, windowEnd: end };
  }
  if (input.scale === "month") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 15);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return { windowStart: start, windowEnd: end };
  }
  const dayStart = startOfDay(now);
  return {
    windowStart: dayStart,
    windowEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
  };
}

function pixelsPerMinuteForScale(scale: TimelineScale, start: Date, end: Date): number {
  if (scale === "day") return 2;
  if (scale === "week") return 0.4;
  if (scale === "month") return 0.16;
  const totalDays = Math.max(1, minutesBetween(start, end) / (60 * 24));
  return Math.max(0.08, Math.min(1.4, 0.8 / totalDays));
}

function inferUpcomingAt(tile: Tile): Date | null {
  return (
    tile.temporal.fixedStart ??
    tile.temporal.dueAt ??
    tile.temporal.releaseAt ??
    tile.temporal.activeStart ??
    tile.temporal.activeEnd ??
    null
  );
}

function inferUpdatedAt(tile: Tile, latestByTile: Map<TileId, number>): number | null {
  const values: number[] = [];
  const timelineLatest = latestByTile.get(tile.core.id);
  if (typeof timelineLatest === "number") values.push(timelineLatest);
  pushDate(values, tile.core.startedAt);
  pushDate(values, tile.core.completedAt);
  pushDate(values, tile.temporal.releaseAt);
  pushDate(values, tile.temporal.dueAt);
  pushDate(values, tile.temporal.fixedStart);
  pushDate(values, tile.temporal.fixedEnd);
  pushDate(values, tile.temporal.activeStart);
  pushDate(values, tile.temporal.activeEnd);
  for (const segment of tile.work.segments) {
    pushDate(values, segment.startAt);
    pushDate(values, segment.endAt);
    pushDate(values, segment.expectedEndAt ?? null);
  }
  if (values.length === 0) return null;
  return Math.max(...values);
}

function pushDate(values: number[], date: Date | null) {
  if (!date) return;
  const time = date.getTime();
  if (!Number.isNaN(time)) values.push(time);
}

function assignLanes(
  blocks: Array<{
    topPx: number;
    heightPx: number;
    lane: number;
    totalLanes: number;
  }>,
) {
  const active: Array<{
    bottom: number;
    lane: number;
    block: {
      topPx: number;
      heightPx: number;
      lane: number;
      totalLanes: number;
    };
  }> = [];
  for (const block of blocks) {
    const top = block.topPx;
    const bottom = block.topPx + block.heightPx;
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].bottom <= top) {
        active.splice(i, 1);
      }
    }
    const used = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    block.lane = lane;
    active.push({ bottom, lane, block });
    const total = Math.max(1, ...active.map((item) => item.lane + 1));
    for (const item of active) {
      item.block.totalLanes = Math.max(item.block.totalLanes, total);
    }
  }
}

function startOfDay(now: Date): Date {
  const out = new Date(now);
  out.setHours(0, 0, 0, 0);
  return out;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

const timeFormattersByTz = new Map<string, Intl.DateTimeFormat>();
const dateFormattersByTz = new Map<string, Intl.DateTimeFormat>();

function formatTime(d: Date, tz?: string | null): string {
  if (tz) {
    let fmt = timeFormattersByTz.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
      timeFormattersByTz.set(tz, fmt);
    }
    return fmt.format(d);
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date, tz?: string | null): string {
  if (tz) {
    let fmt = dateFormattersByTz.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-GB", {
        month: "2-digit",
        day: "2-digit",
        timeZone: tz,
      });
      dateFormattersByTz.set(tz, fmt);
    }
    return fmt.format(d);
  }
  return d.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
}

function formatDuration(start: Date, end: Date): string {
  const totalMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildMarkers(
  windowStart: Date,
  windowEnd: Date,
  pxPerMinute: number,
  scale: TimelineScale,
): Array<{ label: string; topPx: number }> {
  const markers: Array<{ label: string; topPx: number }> = [];
  const cursor = new Date(windowStart);
  const stepHours = scale === "day" ? 1 : scale === "week" ? 6 : 24;
  while (cursor <= windowEnd) {
    markers.push({
      label:
        scale === "day"
          ? formatTime(cursor)
          : cursor.toLocaleDateString([], { month: "2-digit", day: "2-digit" }),
      topPx: minutesBetween(windowStart, cursor) * pxPerMinute,
    });
    cursor.setHours(cursor.getHours() + stepHours, 0, 0, 0);
  }
  return markers;
}

function groupByProject(tiles: Tile[]): ListSection[] {
  const buckets = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const projectLabel = tile.annotation.labels.find((label) => label.startsWith("project:"));
    const project = projectLabel
      ? projectLabel.slice("project:".length).trim() || "No Project"
      : "No Project";
    if (!buckets.has(project)) buckets.set(project, []);
    buckets.get(project)?.push(tile);
  }
  return Array.from(buckets.entries())
    .map(([label, groupedTiles]) => ({
      id: `project:${label.toLowerCase()}`,
      label,
      tiles: sortTilesByRecency(groupedTiles),
    }))
    .sort(
      (a, b) =>
        b.tiles.length - a.tiles.length ||
        a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
    );
}

function groupByTag(tiles: Tile[]): ListSection[] {
  const buckets = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const plainTags = tile.annotation.labels.filter((label) => !label.startsWith("project:"));
    if (plainTags.length === 0) {
      if (!buckets.has("Untagged")) buckets.set("Untagged", []);
      buckets.get("Untagged")?.push(tile);
      continue;
    }
    for (const tag of plainTags) {
      const normalized = tag.trim();
      const key = normalized ? `#${normalized}` : "Untagged";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)?.push(tile);
    }
  }
  return Array.from(buckets.entries())
    .map(([label, groupedTiles]) => ({
      id: `tag:${label.toLowerCase()}`,
      label,
      tiles: sortTilesByRecency(groupedTiles),
    }))
    .sort(
      (a, b) =>
        b.tiles.length - a.tiles.length ||
        a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
    );
}

function sortTilesByRecency(tiles: Tile[]): Tile[] {
  const copy = [...tiles];
  copy.sort((a, b) => inferSortTimestamp(b) - inferSortTimestamp(a));
  return copy;
}

function fallbackStateLabel(id: WorkspaceGroup["id"]): string {
  if (id === "focus") return "Focus";
  if (id === "ready") return "Ready";
  if (id === "scheduled") return "Scheduled";
  if (id === "recent") return "Recent Activity";
  return "Log";
}

function inferSortTimestamp(tile: Tile): number {
  const candidates: number[] = [];
  pushDate(candidates, tile.core.startedAt);
  pushDate(candidates, tile.core.completedAt);
  pushDate(candidates, tile.temporal.activeStart);
  pushDate(candidates, tile.temporal.activeEnd);
  pushDate(candidates, tile.temporal.fixedStart);
  pushDate(candidates, tile.temporal.fixedEnd);
  pushDate(candidates, tile.temporal.dueAt);
  for (const segment of tile.work.segments) {
    pushDate(candidates, segment.startAt);
    pushDate(candidates, segment.endAt);
  }
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}
