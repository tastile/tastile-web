import type { CalendarEvent, EventColor } from "@/lib/domain/calendar";
import { EVENT_COLOR_HEX } from "@/lib/domain/calendar";

/**
 * Inline CSS for an event tile.  Earlier this carried a 3px
 * colored left stripe; that has been removed in favor of a flat
 * tinted background.  The tile still reads as a colored card via
 * `backgroundColor` alone — no decorative borders.
 *
 * Text color stays in the same hue family but darker so it
 * remains readable on the tinted background.
 */
export interface TileStyle {
  backgroundColor: string;
  color: string;
}

export function eventTileStyle(color: EventColor): TileStyle {
  const hex = EVENT_COLOR_HEX[color] ?? EVENT_COLOR_HEX.blue;
  return {
    backgroundColor: `color-mix(in oklab, ${hex} 22%, var(--color-surface-0))`,
    color: `color-mix(in oklab, ${hex} 70%, var(--color-foreground))`,
  };
}

/**
 * Compact tile style for the month view.  Same color rules as
 * `eventTileStyle`, slightly darker text so the title stays
 * readable at 10px.
 */
export function monthEventStyle(color: EventColor): TileStyle {
  const hex = EVENT_COLOR_HEX[color] ?? EVENT_COLOR_HEX.blue;
  return {
    backgroundColor: `color-mix(in oklab, ${hex} 22%, var(--color-surface-0))`,
    color: `color-mix(in oklab, ${hex} 60%, var(--color-foreground))`,
  };
}

/**
 * Lane assignment for time-boxed events.  This is purely a
 * presentation concern: the server returns occurrences sorted by
 * start time only, and the client decides how many vertical
 * columns ("lanes") each cluster of overlapping events needs.
 *
 * Algorithm: classic interval-graph coloring.
 *   1. Sort events by start, then by longest-first within ties.
 *   2. Walk through, keeping a per-lane `lastEnd`.  Place the
 *      event in the lowest-index lane whose `lastEnd` is at or
 *      before the new event's start; otherwise open a new lane.
 *   3. `laneCount` for a cluster is the max lanes used in that
 *      cluster.  Each event knows its own `laneIndex` and the
 *      `laneCount` of the cluster it belongs to.
 *
 * All-day events are excluded here; the all-day lane handles them.
 */
export interface LaidOutEvent {
  event: CalendarEvent;
  laneIndex: number;
  laneCount: number;
  top: number;
  height: number;
}

interface RawInterval {
  event: CalendarEvent;
  startMs: number;
  endMs: number;
}

function startOfDayMs(day: string, tzOffsetMinutes = 0): number {
  // day is "YYYY-MM-DD"; shift the UTC midnight by the local TZ offset
  // (minutes east of UTC, so JST=+540) so the day bucket matches the
  // user's wall clock. DayView/WeekView/MonthView pass tzOffset in;
  // when omitted we keep the legacy UTC-midnight bucket for callers
  // that already localized the input.
  return (
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) -
    tzOffsetMinutes * 60_000
  );
}

function endOfDayMs(day: string, tzOffsetMinutes = 0): number {
  return startOfDayMs(day, tzOffsetMinutes) + 24 * 60 * 60 * 1000;
}

/**
 * Format a UTC ISO timestamp as a local "HH:MM" string in the viewer's
 * timezone.  `tzOffsetMinutes` is minutes east of UTC (JST=+540).
 *
 * The day/grid positioning code shifts the same way (see
 * `startOfDayMs`), so the printed time matches the row the event
 * lands on.  When `tzOffsetMinutes` is omitted we fall back to the
 * raw UTC slice, which preserves the previous (UTC) behaviour for
 * callers that pass already-localized strings.
 */
export function formatLocalTimeOfDay(iso: string, tzOffsetMinutes = 0): string {
  if (!iso) return "";
  const utcMs = Date.parse(iso);
  if (Number.isNaN(utcMs)) return "";
  const localMs = utcMs + tzOffsetMinutes * 60_000;
  const d = new Date(localMs);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function clipToDay(e: RawInterval, dayMsStart: number, dayMsEnd: number): RawInterval | null {
  const start = Math.max(e.startMs, dayMsStart);
  const end = Math.min(e.endMs, dayMsEnd);
  if (end <= start) return null;
  return { event: e.event, startMs: start, endMs: end };
}

/**
 * Lay out timed events for a single day.  `HOUR_HEIGHT` lets the
 * caller express vertical position in pixels; we return absolute
 * pixel values so the view component can drop them straight into
 * inline styles.
 */
export function layoutDayLanes(
  events: CalendarEvent[],
  day: string,
  hourHeight: number,
  tzOffsetMinutes = 0,
): LaidOutEvent[] {
  const dayStart = startOfDayMs(day, tzOffsetMinutes);
  const dayEnd = endOfDayMs(day, tzOffsetMinutes);

  const raw: RawInterval[] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start).getTime();
    const en = new Date(e.end).getTime();
    if (Number.isNaN(s) || Number.isNaN(en) || en <= s) continue;
    const clipped = clipToDay({ event: e, startMs: s, endMs: en }, dayStart, dayEnd);
    if (!clipped) continue;
    raw.push(clipped);
  }
  if (raw.length === 0) return [];

  // Sort: earlier start first; tie-break with longer first so a
  // long event claims a lane before a short one.
  raw.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    const aDur = a.endMs - a.startMs;
    const bDur = b.endMs - b.startMs;
    return bDur - aDur;
  });

  // Greedy lane assignment.  `lanes[i].lastEndMs` is the end of
  // the most recent event placed in lane i.
  const lanes: number[] = [];
  const placed: { event: CalendarEvent; laneIndex: number; startMs: number; endMs: number }[] = [];
  for (const r of raw) {
    let lane = -1;
    for (let i = 0; i < lanes.length; i++) {
      if ((lanes[i] ?? Number.POSITIVE_INFINITY) <= r.startMs) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(r.endMs);
    } else {
      lanes[lane] = r.endMs;
    }
    placed.push({ event: r.event, laneIndex: lane, startMs: r.startMs, endMs: r.endMs });
  }

  // Cluster events: two events are in the same cluster if their
  // intervals overlap.  For each event, laneCount = max laneIndex+1
  // over its cluster.  We compute clusters via a sweep.
  // First, mark clusters.  We sweep sorted by start, opening a new
  // cluster when the current event starts after the cluster's
  // running `maxEnd`.
  const clusterOfEvent: number[] = new Array(placed.length).fill(-1);
  const clusterMaxLane: number[] = [];
  let curCluster = -1;
  let curClusterEnd = Number.NEGATIVE_INFINITY;
  let curClusterMaxLane = 0;
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    if (!p) continue;
    if (p.startMs >= curClusterEnd) {
      curCluster++;
      clusterMaxLane.push(0);
      curClusterEnd = p.endMs;
      curClusterMaxLane = 0;
    } else {
      if (p.endMs > curClusterEnd) curClusterEnd = p.endMs;
    }
    clusterOfEvent[i] = curCluster;
    if (p.laneIndex + 1 > curClusterMaxLane) curClusterMaxLane = p.laneIndex + 1;
    clusterMaxLane[curCluster] = curClusterMaxLane;
  }
  // Re-walk to capture the final clusterMaxLane (since we update
  // it as we go but the loop above may have re-opened the cluster).
  // Easier: do a second pass that uses clusterOfEvent.
  for (let i = 0; i < placed.length; i++) {
    const c = clusterOfEvent[i];
    if (c === undefined) continue;
    const laneIdx = placed[i]?.laneIndex;
    const current = clusterMaxLane[c];
    if (laneIdx !== undefined && current !== undefined && laneIdx + 1 > current) {
      clusterMaxLane[c] = laneIdx + 1;
    }
  }

  const out: LaidOutEvent[] = [];
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const clusterIdx = clusterOfEvent[i];
    if (!p || clusterIdx === undefined) continue;
    const laneCount = clusterMaxLane[clusterIdx] ?? 1;
    const top = ((p.startMs - dayStart) / (60 * 60 * 1000)) * hourHeight;
    const height = Math.max(20, ((p.endMs - p.startMs) / (60 * 60 * 1000)) * hourHeight);
    out.push({
      event: p.event,
      laneIndex: p.laneIndex,
      laneCount,
      top,
      height,
    });
  }
  return out;
}

/**
 * True when the event's [start,end) overlaps the given day.
 * Multi-day all-day events (e.g. conference) match every day they
 * span.
 */
export function eventSpansDay(event: CalendarEvent, day: string, tzOffsetMinutes = 0): boolean {
  const dayStart = startOfDayMs(day, tzOffsetMinutes);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const s = new Date(event.start).getTime();
  const en = new Date(event.end).getTime();
  if (Number.isNaN(s) || Number.isNaN(en)) return false;
  // Treat zero-length or backwards intervals (start >= end) as
  // anchored on the start day only -- covers all-day events that
  // were stored with start == end == midnight.
  if (en <= s) return s >= dayStart && s < dayEnd;
  return s < dayEnd && en > dayStart;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relative-display date helpers (2026-06-30 timeline relative display)
//
// Three display modes share `anchor` semantics: "scope" treats anchor as a
// free user-selected date; "around" / "future" force anchor onto today and
// shift the visible window. Helpers here translate (mode, view, anchor) into
// concrete RFC3339 strings the events API understands, plus the date columns
// for Week/Month views.
// ─────────────────────────────────────────────────────────────────────────────

export type DisplayMode = "scope" | "around" | "future";

export interface DisplayRange {
  start: string; // RFC3339
  end: string; // RFC3339 (exclusive end, used by the events API)
}

/** Half-scope in days for centered mode. */
function halfScope(view: "day" | "week" | "month"): number {
  if (view === "day") return 0.5; // 12 h, treated as fractional day
  if (view === "week") return 3; // 7-day scope, 3 before + 3 after
  return 15; // 31-day scope, 15 before + 15 after
}

/** Full scope size in days for forward mode. */
function forwardScopeDays(view: "day" | "week" | "month"): number {
  if (view === "day") return 1;
  if (view === "week") return 7;
  return 31;
}

/**
 * Compute the [start, end) range passed to the events API given the
 * current display mode and view. `anchor` is treated as a YYYY-MM-DD
 * (today in modes around/future — caller resolves this).
 */
export function getModeRange(
  view: "day" | "week" | "month" | "year",
  mode: DisplayMode,
  anchor: string,
  tzOffsetMinutes: number,
): DisplayRange {
  // Anchor is a local date string. We compute an instant on the user's
  // local midnight, then shift from there.
  const [y, m, d] = anchor.split("-").map(Number);
  const localMidnightMs = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - tzOffsetMinutes * 60_000;

  if (view === "year") {
    // YearView only handles a calendar year at a time; "scope" returns the
    // anchor's year as a [Jan 1, Jan 1 next year) date-string range.
    // Other modes for year are not currently driven by the UI.
    const year = parseInt(anchor.slice(0, 4), 10);
    return {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
    };
  }

  if (view === "day") {
    if (mode === "around") {
      const nowMs = Date.now();
      return {
        start: new Date(nowMs - 12 * 60 * 60 * 1000).toISOString(),
        end: new Date(nowMs + 12 * 60 * 60 * 1000).toISOString(),
      };
    }
    if (mode === "future") {
      const nowMs = Date.now();
      return {
        start: new Date(nowMs).toISOString(),
        end: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    // scope
    return {
      start: new Date(localMidnightMs).toISOString(),
      end: new Date(localMidnightMs + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  if (view === "week") {
    if (mode === "around") {
      const todayMs = Date.now() - tzOffsetMinutes * 60_000;
      const startMs = todayMs - 3 * 24 * 60 * 60 * 1000;
      return {
        start: new Date(startMs).toISOString(),
        end: new Date(todayMs + 4 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    if (mode === "future") {
      const todayMs = Date.now() - tzOffsetMinutes * 60_000;
      return {
        start: new Date(todayMs).toISOString(),
        end: new Date(todayMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    // scope: anchor's week, week start = Sunday.
    // Compute dow from local date components directly to avoid
    // getUTCDay() returning the wrong day on timezone-shifted timestamps.
    // Use localMidnightMs (not UTC midnight) so the API range starts at
    // local midnight — UTC midnight would be 9 AM in JST.
    {
      const yy = y ?? 1970;
      const mm = (m ?? 1) - 1;
      const dd = d ?? 1;
      const dow = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
      const weekStartMs = localMidnightMs - dow * 24 * 60 * 60 * 1000;
      return {
        start: new Date(weekStartMs).toISOString(),
        end: new Date(weekStartMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  }

  // month
  if (mode === "around") {
    const todayMs = Date.now() - tzOffsetMinutes * 60_000;
    const startMs = todayMs - 15 * 24 * 60 * 60 * 1000;
    return {
      start: new Date(startMs).toISOString(),
      end: new Date(todayMs + 16 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (mode === "future") {
    const todayMs = Date.now() - tzOffsetMinutes * 60_000;
    return {
      start: new Date(todayMs).toISOString(),
      end: new Date(todayMs + 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  // scope: anchor's month
  const year = y ?? 1970;
  const month = (m ?? 1) - 1;
  const monthStartMs = Date.UTC(year, month, 1);
  const monthEndMs = Date.UTC(year, month + 1, 0) + 24 * 60 * 60 * 1000 - 1;
  return {
    start: new Date(monthStartMs).toISOString(),
    end: new Date(monthEndMs + 1).toISOString(),
  };
}

/**
 * DayView in mode "around" needs a 24-cell hour grid centered on
 * `now` — first slot is `currentHour - 12`. Mode "future" starts at
 * `currentHour` and wraps to the next day. Mode "scope" starts at
 * midnight. Returns hour numbers (0..23) for the grid, in render
 * order.
 */
export function getDayViewHourOffsets(
  now: Date,
  mode: DisplayMode = "future",
): { startHour: number; hours: number[] } {
  const currentHour = now.getHours();
  const startHour = mode === "around" ? (currentHour - 12 + 24) % 24 : currentHour;
  const hours: number[] = [];
  for (let i = 0; i < 24; i++) {
    hours.push((startHour + i) % 24);
  }
  return { startHour, hours };
}

/**
 * WeekView: produce the 7 dates to render. Mode "scope" → Sun..Sat
 * of anchor's week. Mode "around" → today − 3 .. today + 3. Mode
 * "future" → today .. today + 6.
 */
export function getWeekViewDates(mode: DisplayMode, anchor: string): string[] {
  const [y, m, d] = anchor.split("-").map(Number);
  const yy = y ?? 1970;
  const mm = (m ?? 1) - 1;
  const dd = d ?? 1;

  if (mode === "around") {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(Date.UTC(yy, mm, dd - 3 + i));
      return toIsoDate(day);
    });
  }
  if (mode === "future") {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(Date.UTC(yy, mm, dd + i));
      return toIsoDate(day);
    });
  }
  // scope: Sun..Sat of anchor's week.
  // Compute dow from the local date components directly — using
  // getUTCDay() on a timezone-shifted localMidnightMs gives the
  // wrong day for positive tz offsets (JST etc.).
  const dow = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(yy, mm, dd - dow + i));
    return toIsoDate(day);
  });
}

/**
 * MonthView: produce the dates of the grid as a flat list (already
 * padded so the grid is a whole number of weeks). Mode "scope" →
 * 6 weeks max covering anchor's month. Mode "around" → 31 consecutive
 * dates centered on anchor (today in practice). Mode "future" →
 * today + 31 days. Caller should ensure first cell is the Sunday
 * before and last cell is the Saturday after.
 */
export function getMonthViewDates(
  mode: DisplayMode,
  anchor: string,
  tzOffsetMinutes: number,
): string[] {
  const [y, m, d] = anchor.split("-").map(Number);
  const localMidnightMs = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - tzOffsetMinutes * 60_000;

  if (mode === "around") {
    // 31 days, padded to full weeks
    const startMs = localMidnightMs - 15 * 24 * 60 * 60 * 1000;
    const endMs = startMs + 31 * 24 * 60 * 60 * 1000;
    return padToFullWeeks(startMs, endMs, tzOffsetMinutes);
  }
  if (mode === "future") {
    // 31 days starting today
    const startMs = localMidnightMs;
    const endMs = startMs + 31 * 24 * 60 * 60 * 1000;
    return padToFullWeeks(startMs, endMs, tzOffsetMinutes);
  }
  // scope: build full month grid
  const year = y ?? 1970;
  const month = (m ?? 1) - 1;
  const startMs = Date.UTC(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const endMs = Date.UTC(year, month, lastDay) + 24 * 60 * 60 * 1000;
  return padToFullWeeks(startMs, endMs, tzOffsetMinutes);
}

function padToFullWeeks(startMs: number, endMs: number, tzOffsetMinutes = 0): string[] {
  // snap start to previous Sunday.
  // Recover the local date by adding back the timezone offset so that
  // getUTCDay() returns the correct local day of week.
  const localMs = startMs + tzOffsetMinutes * 60_000;
  const startDow = new Date(localMs).getUTCDay();
  const gridStart = startMs - startDow * 24 * 60 * 60 * 1000;
  // ensure last cell is a Saturday
  const days = Math.ceil((endMs - gridStart) / (24 * 60 * 60 * 1000));
  let totalDays = days;
  while (totalDays % 7 !== 0) totalDays++;
  const out: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    out.push(toIsoDate(new Date(gridStart + i * 24 * 60 * 60 * 1000)));
  }
  // ensure gridStart is on or before startMs and final on or after endMs
  void gridStart;
  return out;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get "today" as a local YYYY-MM-DD using the same convention as
 *  CalendarMain's localIsoDate. Exposed for callers that build their
 *  own anchor (e.g. mode toggles). */
export function todayLocalIso(tzOffsetMinutes: number): string {
  const now = new Date(Date.now() + tzOffsetMinutes * 60_000);
  return now.toISOString().slice(0, 10);
}

// silence unused-export linting for halfScope/forwardScopeDays; they
// document the constants without being directly called externally yet.
void halfScope;
void forwardScopeDays;
