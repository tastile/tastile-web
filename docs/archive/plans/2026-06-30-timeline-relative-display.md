# Timeline Relative Display — 3 display modes

## Date
2026-06-30

## Problem
The Day/Week/Month views show a single period bounded by natural calendar boundaries (midnight / Sunday / 1st of month). When the user is near the end of the displayed period, future events fall outside the visible range and are easy to miss.

## Goal
Provide three display modes so the user can always see future events relative to "now":

| Mode | Name | Anchor | Range | Prev/Next |
|---|---|---|---|---|
| A | scope | Any user-selected date | Natural period start → end | Enabled |
| B | around | Today (always) | Today − half-scope → Today + half-scope | Disabled |
| C | future | Today (always) | Today → Today + scope | Disabled |

Scope per view:

| View | scope | around range | future range |
|---|---|---|---|
| DAY | 24 h | now ± 12 h | now → now + 24 h |
| WEEK | 7 d | today − 3 d → today + 3 d | today → today + 7 d |
| MONTH | 31 d | today − 15 d → today + 15 d | today → today + 31 d |

The `LIST` view is excluded (already structured around "upcoming events").

## State

`CalendarMain` adds one piece of state:

```ts
type DisplayMode = "scope" | "around" | "future";
const [mode, setMode] = useState<DisplayMode>("scope");
```

URL sync via `?mode=around` (default omitted, keeps existing URLs clean).

## Data fetching
`useEvents(range)` is unchanged. The `range` `useMemo` is extended with one branch per mode:

```
scope (A):
  DAY  → [anchor 00:00, anchor 24:00]
  WEEK → [Sun(anchor), Sat(anchor)]
  MONTH → [1st(anchor), last(anchor)]

around (B):
  DAY  → [now − 12 h, now + 12 h]
  WEEK → [today − 3 d, today + 3 d]
  MONTH → [today − 15 d, today + 15 d]

future (C):
  DAY  → [now, now + 24 h]
  WEEK → [today, today + 7 d]
  MONTH → [today, today + 31 d]
```

## Rendering
`DayView` / `WeekView` / `MonthView` are unchanged structurally. The `anchor` and the view-internal "dates" are what change:

- `anchor` is forced to today in modes B/C.
- DayView needs a small new helper `getCenteredDayHours()` for mode B's hour grid (24 slots, anchored at the current hour, not at midnight). Mode C's day grid also uses now as the first hour but wraps to the following 24 h.
- WeekView uses existing `getWeekDates(anchor - 3 days)` for mode B and a 7-day forward start for mode C.
- MonthView uses a new `getCenteredMonthDates(anchor)` for mode B (31 consecutive days centered on today) and an "N forward days" generator for mode C.

## MiniCalendar highlight
`CalendarSidePanel.getHighlightDates(view, anchor)` gains a mode branch:

- Mode A → existing per-view range
- Mode B → `undefined` (today only — see design note)
- Mode C → today → range end (clipped to current calendar cell visibility)

## Toolbar
Add a 3-segment switch next to the existing DAY/WEEK/MONTH/LIST:

```
[Scope] [Around] [Future]
```

Same visual treatment as the view switcher; `data-testid="cal-mode-{mode}"`.

Prev/Next buttons:

- Mode A → existing behavior
- Mode B/C → `disabled` + tooltip "Always anchored at today"

Toolbar title:

- Mode A → existing format
- Mode B → `Today · ±12h` / `Today · ±3d (Jun 27 – Jul 3)` / `Today · ±15d (Jun 15 – Jul 15)`
- Mode C → `From now · 24h` / `From now · 7d (Jun 30 – Jul 6)` / `From now · 31d (Jun 30 – Jul 31)`

## Files

| File | Change |
|---|---|
| `src/components/calendar/CalendarMain.tsx` | Add `mode` state, URL sync, mode-aware title and Prev/Next, range useMemo branch, mode switcher |
| `src/lib/calendar/layout.ts` | Add `getCenteredDayHours()`, `getCenteredMonthDates()` helpers |
| `src/components/calendar/DayView.tsx` | Consume centered hour grid when `mode=around` |
| `src/components/calendar/WeekView.tsx` | Compute date list based on mode-aware offset |
| `src/components/calendar/MonthView.tsx` | Compute date list based on mode-aware offset |
| `src/components/panels/CalendarSidePanel.tsx` | Extend `getHighlightDates()` with mode branch |
| `src/lib/utils/date.ts` (or inline) | Add `todayIso()` alias of `localIsoDate()` if missing |

## Risks & Mitigations

1. **Mode B/C always-on-today surprise**: user navigating with arrow keys gets no feedback. Mitigated by disabled buttons + tooltip + visible "Today ·" prefix in title.
2. **Date math edge cases** at end-of-month / DST: keep all math in UTC (`Date.UTC`) for consistency with existing code; render labels via `toLocaleDateString` with the user's locale.
3. **`?mode=future` URL survives refresh**: state initializer reads from URL, default `scope`. No migration needed.
4. **Side panel state leak** if page changes view+mode combination: `useSidePanel(<CalendarSidePanel anchor=... mode=... />)` already memoizes by content; the new `mode` prop is a normal prop, so reactivity is preserved (the recent fix to `useSidePanel` uses `useSyncExternalStore` and is unaffected by extra props).

## Validation

- Click each mode button → URL `?mode=` updates
- Reload with `?mode=around` → see centered range
- Mode B with DAY → first visible hour is `hour - 12` modulo 24
- Mode C with WEEK → first visible day cell is today, last is today + 6
- Prev/Next disabled in modes B/C
- MiniCalendar side panel updates highlight correctly across modes
- No `Maximum update depth exceeded` (recent `useSidePanel` fix must hold up)
