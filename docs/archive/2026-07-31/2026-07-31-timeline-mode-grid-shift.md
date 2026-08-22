# Timeline Mode Grid Shift Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Day/Week timeline grid visually shift based on Scope/Around/Future mode, not just filter data.

**Architecture:** Add mode-aware time range helpers in `layout.ts`, pass `startTime`/`endTime` to vendored DayView, add `weekDates` prop to vendored WeekView to override week calculation, and wire everything through DayPanel/WeekPanel.

**Tech Stack:** TypeScript, React, dayjs (vendored Mantine schedule components)

---

## Problem Analysis

Currently, Scope/Around/Future modes only filter which events are fetched from the API. The visual grid always shows:
- **Day view:** 00:00–23:59 (full 24h), just auto-scrolls to current hour
- **Week view:** Always Mon–Sun (or Sun–Sat) of the week containing the anchor date

The grid's `startTime`/`endTime` (DayView) and date list (WeekView) never change based on mode.

## Task 1: Add mode-aware time range helpers to `layout.ts`

**Files:**
- Modify: `src/lib/calendar/layout.ts:156-167`

**Step 1: Add `getDayViewTimeRange` function**

```ts
/**
 * Compute startTime/endTime for the DayView grid based on display mode.
 * - scope: full 24h (00:00:00 – 23:59:59)
 * - around: 24h centered on current time (currentHour-12 – currentHour+12)
 * - future: 24h from current time (currentHour – currentHour+24)
 *
 * When end hour wraps past midnight, it's clamped to 23:59:59 (the grid
 * still shows all slots, but the visible range starts at the right place).
 */
export function getDayViewTimeRange(
  mode: DisplayMode,
): { startTime: string; endTime: string } {
  if (mode === "scope") {
    return { startTime: "00:00:00", endTime: "23:59:59" };
  }

  const now = new Date();
  const currentHour = now.getHours();

  if (mode === "around") {
    const startHour = (currentHour - 12 + 24) % 24;
    const endHour = (currentHour + 12) % 24;
    // When wrapping (e.g. startHour=14, endHour=2), show full 24h
    // by using 00:00:00–23:59:59 but scroll to startHour.
    if (endHour <= startHour) {
      return { startTime: "00:00:00", endTime: "23:59:59" };
    }
    return {
      startTime: `${String(startHour).padStart(2, "0")}:00:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00:00`,
    };
  }

  // future
  const endHour = (currentHour + 24) % 24;
  if (endHour === 0) {
    // currentHour is 0 → full 24h from midnight
    return { startTime: "00:00:00", endTime: "23:59:59" };
  }
  if (endHour <= currentHour) {
    // Wraps past midnight — show from currentHour to 23:59:59
    return {
      startTime: `${String(currentHour).padStart(2, "0")}:00:00`,
      endTime: "23:59:59",
    };
  }
  return {
    startTime: `${String(currentHour).padStart(2, "0")}:00:00`,
    endTime: `${String(endHour).padStart(2, "0")}:00:00`,
  };
}
```

**Step 2: Update `getScrollTimeForMode` in DayPanel.tsx**

For "around" mode, scroll to the start of the visible range (currentHour - 12).
For "future" mode, scroll to the current hour.

```ts
function getScrollTimeForMode(mode: DisplayMode): string | undefined {
  if (mode === "scope") return undefined;
  const now = new Date();
  const h = now.getHours();
  if (mode === "around") {
    const scrollH = (h - 12 + 24) % 24;
    return `${String(scrollH).padStart(2, "0")}:00:00`;
  }
  // future
  return `${String(h).padStart(2, "0")}:00:00`;
}
```

**Step 3: Run existing tests**

```bash
cd tastile-web && bun test src/lib/calendar/layout.test.ts
```

Expected: PASS (no existing behavior changed)

---

## Task 2: Wire time range into DayPanel

**Files:**
- Modify: `src/components/schedule/DayPanel.tsx:78-124`

**Step 1: Import and use `getDayViewTimeRange`**

Replace the `void range;` line and pass computed times to DayView:

```ts
import { getDayViewTimeRange, type DisplayMode, type DisplayRange } from "@/lib/calendar/layout";

// Inside the component, replace `void range;` with:
const { startTime, endTime } = getDayViewTimeRange(displayMode);
```

Then pass to DayView:

```tsx
<DayView
  date={anchor}
  events={scheduleEvents}
  withHeader={false}
  canDragEvent={() => false}
  canResizeEvent={() => false}
  withDragSlotSelect
  withCurrentTimeIndicator
  intervalMinutes={30}
  startTime={startTime}
  endTime={endTime}
  onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
  onTimeSlotClick={({ slotStart, slotEnd }) => onSlotCreate(slotStart, slotEnd)}
  onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
  renderEventBody={(e) => renderEventBody(e, "day")}
  scrollAreaProps={{ style: { height: "100%" } }}
  startScrollTime={scrollTime}
  style={{ "--day-view-slot-height": `${zoom}px` } as React.CSSProperties}
/>
```

**Step 2: Run DayPanel tests**

```bash
cd tastile-web && bun test src/components/schedule/__tests__/DayPanel.test.tsx
```

Expected: PASS

---

## Task 3: Add `weekDates` prop to vendored WeekView

**Files:**
- Modify: `src/lib/vendored/mantine-schedule/components/WeekView/WeekView.tsx:106-299` (props interface)
- Modify: `src/lib/vendored/mantine-schedule/components/WeekView/WeekView.tsx:559-564` (weekdays computation)

**Step 1: Add optional `weekDates` prop to `WeekViewProps`**

After the `date` prop (line 113), add:

```ts
  /** Override the list of dates to display. When provided, skips internal week calculation. */
  weekDates?: DateStringValue[];
```

**Step 2: Use `weekDates` in the component body**

Replace line 559-564:

```ts
const weekdays = weekDates ?? getWeekDays({
  week: date,
  withWeekendDays,
  weekendDays: ctx.getWeekendDays(weekendDays),
  firstDayOfWeek: ctx.getFirstDayOfWeek(firstDayOfWeek),
});
```

Also update `getWeekViewEvents` call (line 575-584) to use the overridden weekdays for event filtering. The `date` prop passed to `getWeekViewEvents` should be the first day of the custom week:

```ts
const weekEvents = getWeekViewEvents({
  date: weekdays[0] ?? date,
  events: expandedEvents,
  startTime,
  endTime,
  intervalMinutes,
  firstDayOfWeek: ctx.getFirstDayOfWeek(firstDayOfWeek),
  weekendDays: ctx.getWeekendDays(weekendDays),
  withWeekendDays,
});
```

**Step 3: Update `expandedEvents` range**

Also update the `expandRecurringEvents` call (line 566-573) to use the overridden weekdays:

```ts
const expandedEvents = expandRecurringEvents({
  events,
  rangeStart: dayjs(weekdays[0]).startOf("day").toDate(),
  rangeEnd: dayjs(weekdays[weekdays.length - 1])
    .endOf("day")
    .toDate(),
  expansionLimit: recurrenceExpansionLimit,
});
```

This is already correct since it uses `weekdays` which will now be the overridden list.

---

## Task 4: Add mode-aware week date helpers to `layout.ts`

**Files:**
- Modify: `src/lib/calendar/layout.ts:174-198`

The existing `getWeekViewDates` function already computes correct dates for each mode. It just needs to be exported and used. Let's verify it handles modes correctly:

- "scope": Sun..Sat of anchor's week ✓
- "around": anchor-3 .. anchor+3 (7 days centered) ✓
- "future": anchor .. anchor+6 (7 days from anchor) ✓

This function is already exported. Good.

---

## Task 5: Wire week dates into WeekPanel

**Files:**
- Modify: `src/components/schedule/WeekPanel.tsx`

**Step 1: Import `getWeekViewDates` and compute week dates**

```ts
import { getWeekViewDates, type DisplayMode, type DisplayRange } from "@/lib/calendar/layout";
```

Inside the component, compute the dates to pass:

```ts
const weekDates = getWeekViewDates(displayMode, anchor);
```

**Step 2: Pass `weekDates` to WeekView**

```tsx
<WeekView
  data-testid="week-view"
  date={anchor}
  weekDates={weekDates}
  events={scheduleEvents}
  withHeader={false}
  firstDayOfWeek={firstDayOfWeek}
  withWeekendDays
  canDragEvent={() => false}
  canResizeEvent={() => false}
  withDragSlotSelect
  withCurrentTimeIndicator
  intervalMinutes={60}
  onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
  onTimeSlotClick={({ slotStart, slotEnd }) => onSlotCreate(slotStart, slotEnd)}
  onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
  renderEventBody={(e) => renderEventBody(e, "week")}
  scrollAreaProps={{ style: { height: "100%" } }}
  startScrollTime={scrollTime}
  style={{ "--week-view-slot-height": `${zoom}px` } as React.CSSProperties}
/>
```

Remove the `void range;` line.

**Step 3: Run WeekPanel tests**

```bash
cd tastile-web && bun test src/components/schedule/__tests__/WeekPanel.test.tsx
```

Expected: PASS

---

## Task 6: Run full test suite and lint

**Step 1: Run all schedule-related tests**

```bash
cd tastile-web && bun test src/components/schedule/ src/lib/calendar/
```

**Step 2: Run lint**

```bash
cd tastile-web && bun run lint
```

**Step 3: Run typecheck**

```bash
cd tastile-web && bun run typecheck
```

All expected: PASS

---

## Verification Checklist

After implementation, verify:

1. **Day view + Scope**: Grid shows 00:00–23:59, no scroll shift. ✓ (unchanged)
2. **Day view + Around**: Grid shows currentHour-12 – currentHour+12 hours, scrolled to start. If now=14:00, grid shows02:00–14:00.
3. **Day view + Future**: Grid shows currentHour – currentHour+24, scrolled to start. If now=14:00, grid shows14:00–14:00 next day.
4. **Week view + Scope**: Grid shows Mon–Sun (or Sun–Sat) of anchor's week. ✓ (unchanged)
5. **Week view + Around**: Grid shows 7 days centered on today (today-3 .. today+3).
6. **Week view + Future**: Grid shows 7 days starting from today (today .. today+6).
7. **Current time indicator**: Still visible and correctly positioned in around/future modes.
8. **Events**: Correctly positioned within the shifted grid.
