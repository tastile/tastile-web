// ─────────────────────────────────────────────────────────────────────────────
// Relative-display date helpers (2026-06-30 timeline relative display)
//
// Three display modes share `anchor` semantics: "scope" treats anchor as a
// free user-selected date; "around" / "future" force anchor onto today and
// shift the visible window. Helpers here translate (mode, view, anchor) into
// concrete RFC3339 strings the events API understands.
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
    const year = Number.parseInt(anchor.slice(0, 4), 10);
    return {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
    };
  }

  if (view === "day") {
    // The day grid is always a 24 h window starting at the mode's origin,
    // so the API range must be exactly that window (it may cross midnight).
    const originMs = getDayViewOrigin(mode, anchor, Date.now(), tzOffsetMinutes);
    return {
      start: new Date(originMs).toISOString(),
      end: new Date(originMs + 24 * 60 * 60 * 1000).toISOString(),
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

/** Get "today" as a local YYYY-MM-DD using the same convention as
 *  CalendarMain's localIsoDate. Exposed for callers that build their
 *  own anchor (e.g. mode toggles). */
function todayLocalIso(tzOffsetMinutes: number): string {
  const now = new Date(Date.now() + tzOffsetMinutes * 60_000);
  return now.toISOString().slice(0, 10);
}

/**
 * Day view window.
 *
 * The DayView grid is ALWAYS a full 24 h (00:00:00 – 23:59:59) of a single
 * "virtual day". Display modes do not change which grid rows exist — they
 * only change which real instant the grid's 00:00 corresponds to:
 *
 * - scope:  origin = local midnight of `anchor`      (virtual == real)
 * - around: origin = floor(now, hour) − 12 h          (crosses midnight)
 * - future: origin = floor(now, hour)                 (crosses midnight)
 *
 * Callers map real instants into the grid by adding `shiftMs`, and map
 * grid interactions back to real instants by subtracting it.
 */
export interface DayViewWindow {
  /** Real instant (ms) rendered at grid 00:00. */
  originMs: number;
  /** Add to a real instant to get its position in the virtual day. */
  shiftMs: number;
  /** Grid start (always full day). */
  startTime: string;
  /** Grid end (always full day). */
  endTime: string;
  /** Where to auto-scroll inside the virtual day, if anywhere. */
  scrollTime?: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Local midnight (real ms) of a YYYY-MM-DD string. When `tzOffsetMinutes`
 * is given, midnight is resolved in that timezone rather than the host's.
 */
function localMidnightOf(anchor: string, tzOffsetMinutes?: number): number {
  const [y, m, d] = anchor.split("-").map(Number);
  if (tzOffsetMinutes === undefined) {
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
  }
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - tzOffsetMinutes * 60_000;
}

/** Real instant that the day grid's 00:00 represents. */
function getDayViewOrigin(
  mode: DisplayMode,
  anchor: string,
  nowMs = Date.now(),
  tzOffsetMinutes?: number,
): number {
  const flooredNow = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  if (mode === "around") return flooredNow - 12 * HOUR_MS;
  if (mode === "future") return flooredNow;
  return localMidnightOf(anchor, tzOffsetMinutes);
}

export function getDayViewWindow(
  mode: DisplayMode,
  anchor: string,
  nowMs = Date.now(),
): DayViewWindow {
  const originMs = getDayViewOrigin(mode, anchor, nowMs);
  const shiftMs = localMidnightOf(anchor) - originMs;
  return {
    originMs,
    shiftMs,
    startTime: "00:00:00",
    endTime: "23:59:59",
    // around: "now" sits at the centre of the window; future: at the top.
    scrollTime: mode === "around" ? "12:00:00" : undefined,
  };
}

/**
 * WeekView: produce the 7 dates to render. Mode "scope" →
 * firstDayOfWeek..firstDayOfWeek+6 of anchor's week. Mode "around"
 * → today − 3 .. today + 3. Mode "future" → today .. today + 6.
 *
 * `firstDayOfWeek` must match the value passed to vendored WeekView so
 * the displayed dates align with isWithinWeek's filtering window.
 */
export function getWeekViewDates(
  mode: DisplayMode,
  anchor: string,
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): string[] {
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
  // scope: firstDayOfWeek .. firstDayOfWeek+6 of anchor's week.
  const dow = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
  const offset = (dow - firstDayOfWeek + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(yy, mm, dd - offset + i));
    return toIsoDate(day);
  });
}

/**
 * MonthView: produce the dates of the grid as a flat list (already
 * padded so the grid is a whole number of weeks). Mode "scope" →
 * 6 weeks max covering anchor's month. Mode "around" → 31 consecutive
 * dates centered on anchor (today in practice). Mode "future" →
 * today + 31 days.
 */
function getMonthViewDates(mode: DisplayMode, anchor: string, tzOffsetMinutes: number): string[] {
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
  const localMs = startMs + tzOffsetMinutes * 60_000;
  const startDow = new Date(localMs).getUTCDay();
  const gridStart = startMs - startDow * 24 * 60 * 60 * 1000;
  const days = Math.ceil((endMs - gridStart) / (24 * 60 * 60 * 1000));
  let totalDays = days;
  while (totalDays % 7 !== 0) totalDays++;
  const out: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    out.push(toIsoDate(new Date(gridStart + i * 24 * 60 * 60 * 1000)));
  }
  return out;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// silence unused-export linting for halfScope/forwardScopeDays; they
// document the constants without being directly called externally yet.
void halfScope;
void forwardScopeDays;
