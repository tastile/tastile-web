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

/** Get "today" as a local YYYY-MM-DD using the same convention as
 *  CalendarMain's localIsoDate. Exposed for callers that build their
 *  own anchor (e.g. mode toggles). */
function todayLocalIso(tzOffsetMinutes: number): string {
  const now = new Date(Date.now() + tzOffsetMinutes * 60_000);
  return now.toISOString().slice(0, 10);
}

/**
 * Compute startTime / endTime for the DayView grid based on display mode.
 *
 * - scope:  full 24 h  (00:00:00 – 23:59:59)
 * - around: 24 h centred on now, clipped to same-day bounds
 * - future: from now to end of day
 *
 * The vendored DayView generates slots within a single day, so the
 * range must always satisfy startTime < endTime on the same day.
 * Cross-midnight visualisation is achieved via scroll + event overlap
 * in getDayViewEvents.
 */
export function getDayViewTimeRange(mode: DisplayMode): { startTime: string; endTime: string } {
  if (mode === "scope") {
    return { startTime: "00:00:00", endTime: "23:59:59" };
  }

  const currentHour = new Date().getHours();

  if (mode === "around") {
    // 24 h centred on now, but clipped to [0, 23] so slots are always
    // within the same day.  When clipping shortens the window, the
    // scroll position (getScrollTimeForMode) still centres on "now".
    const startHour = Math.max(0, currentHour - 12);
    const endHour = Math.min(23, currentHour + 12);
    if (startHour >= endHour) {
      return { startTime: "00:00:00", endTime: "23:59:59" };
    }
    return {
      startTime: `${String(startHour).padStart(2, "0")}:00:00`,
      endTime: `${String(endHour).padStart(2, "0")}:59:59`,
    };
  }

  // future: from current hour to end of day
  return {
    startTime: `${String(currentHour).padStart(2, "0")}:00:00`,
    endTime: "23:59:59",
  };
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
