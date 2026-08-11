// src/components/schedule/ScheduleTimeline.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import { CalendarSidePanel } from "@/features/manage-schedule/ui/CalendarSidePanel";
import { getModeRange } from "@/lib/calendar/layout";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useEvents } from "@/shared/hooks/calendar/use-events";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { useCallback, useMemo, useState } from "react";
import { AgendaPanel } from "./AgendaPanel";
import { DayPanel } from "./DayPanel";
import { MonthPanel } from "./MonthPanel";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { WeekPanel } from "./WeekPanel";
import { YearPanel } from "./YearPanel";
import { ZOOM_STEP, useTimelineState } from "./useTimelineState";

type Props = {
  initialView: "day" | "week" | "month" | "year" | "agenda";
};

/** Ensure a date string is in RFC3339 format with time component. */
function toRFC3339(dateStr: string): string {
  if (dateStr.includes("T")) return dateStr;
  return `${dateStr}T00:00:00.000Z`;
}

/** Month and year render a compact projection: a duration floor plus
 *  collapsed recurring occurrences. Day / week / agenda show everything. */
function isCompactView(view: Props["initialView"]): boolean {
  return view === "month" || view === "year";
}
export function ScheduleTimeline({ initialView }: Props) {
  const state = useTimelineState(initialView);
  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const effectiveAnchor = state.effectiveAnchor;

  const range = useMemo(() => {
    if (state.view === "agenda") {
      const day = effectiveAnchor;
      const start = new Date(`${day}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 3);
      const end = new Date(`${day}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 4);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    return getModeRange(state.view, state.mode, effectiveAnchor, tzOffsetMinutes);
  }, [state.view, state.mode, effectiveAnchor, tzOffsetMinutes]);

  const paddedRange = useMemo(() => {
    if (state.view === "month") {
      return {
        start: toRFC3339(range.start),
        end: toRFC3339(range.end),
      };
    }
    if (state.view === "year") {
      const y = effectiveAnchor.slice(0, 4);
      return {
        start: `${y}-01-01T00:00:00.000Z`,
        end: `${Number(y) + 1}-01-01T00:00:00.000Z`,
      };
    }
    if (state.view === "agenda") {
      const end = new Date(range.end);
      end.setDate(end.getDate() + 90);
      return {
        start: toRFC3339(range.start),
        end: toRFC3339(end.toISOString().slice(0, 10)),
      };
    }
    return range;
  }, [range, state.view, effectiveAnchor]);

  // Seed from the RESOLVED view, not the `initialView` route prop. On
  // `/dashboard/timeline?view=month` the prop is "day" while the resolved
  // view is "month", and seeding from the prop would mount the compact
  // month projection with the non-compact minMinutes=0 — a mismatch the
  // reset below can never correct, because the view never changes.
  const [minDuration, setMinDuration] = useState(isCompactView(state.view) ? 5 : 0);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[] | undefined>(undefined);
  const [showRecurring, setShowRecurring] = useState(!isCompactView(state.view));

  // Compact views (month / year) default to a 5-minute floor and hide
  // recurring occurrences; the other views show everything. Both remain
  // user-adjustable from CalendarSidePanel, so they are real state — but
  // they must RESET during the render that first observes the new view,
  // not in a `useEffect` afterwards.
  //
  // With an effect, the first render after a view switch reached
  // `useEvents` with the new view's chunking (maxWindowDays / summary)
  // but the PREVIOUS view's `minDuration`. Because `minMinutes` is part
  // of the chunk cache key, that render fired a full set of requests
  // against keys nothing will ever read again (Week -> Month fired 5
  // chunks at min_minutes=0, then 5 more at min_minutes=5 once the
  // effect landed), and the return trip re-fetched all 7 Week chunks at
  // min_minutes=5 instead of hitting the min_minutes=0 chunks already in
  // cache. Adjusting during render makes React discard the stale pass
  // before commit, so `useEvents` only ever sees a consistent pairing.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [viewForParams, setViewForParams] = useState(state.view);
  if (viewForParams !== state.view) {
    const compact = isCompactView(state.view);
    setViewForParams(state.view);
    setMinDuration(compact ? 5 : 0);
    setShowRecurring(!compact);
  }

  // The Rust /v1/timeline handler caps each request at 31 days, so any
  // view that inherently spans more must be chunked.  Year = 365 days
  // (12 chunks of 31 days), agenda = 97 days (4 chunks of 31).  Month
  // = 31 days but we still chunk it into 7-day windows so the first
  // chunk paints fast and the user sees data filling in progressively
  // rather than waiting for the whole month at once.  Week = 7 days but
  // we chunk into 1-day windows so today (or whichever day resolves
  // first) paints before the other 6 days.  Day is single-request.
  const maxWindowDays =
    state.view === "year" || state.view === "agenda"
      ? 31
      : state.view === "month"
        ? 7
        : state.view === "week"
          ? 1
          : undefined;
  const { events, loading, error } = useEvents({
    ...paddedRange,
    minMinutes: minDuration,
    ownerIds: selectedOwnerIds,
    maxWindowDays,
    limit: state.view === "month" ? 500 : undefined,
    summary: state.view === "month" || state.view === "year" ? "month" : undefined,
    minRecurringStepMs:
      (state.view === "month" || state.view === "year") && !showRecurring
        ? 24 * 60 * 60 * 1000
        : undefined,
  });

  const openCreate = useQuickCreateStore((s) => s.openCreate);
  const setField = useQuickCreateStore((s) => s.setField);
  const loadFromRecurringTile = useQuickCreateStore((s) => s.loadFromRecurringTile);
  const loadFromPlacementEvent = useQuickCreateStore((s) => s.loadFromPlacementEvent);

  const onEventClick = useCallback(
    (event: CalendarEvent) => {
      if (event.source?.kind === 1 && event.tileId) {
        // Recurring tile — use the existing full-tile hydration path.
        loadFromRecurringTile(event.tileId);
        return;
      }
      // Placement / manual event — open the edit panel with all event fields.
      void loadFromPlacementEvent(event);
    },
    [loadFromRecurringTile, loadFromPlacementEvent],
  );

  const onSlotCreate = useCallback(
    (start: string, end: string) => {
      setField("time.span.start", start);
      setField("time.span.end", end);
      setField("time.whenMode", "span");
      openCreate({ initialAllDay: false });
    },
    [openCreate, setField],
  );

  const onMonthDayClick = useCallback(
    (date: string) => {
      state.setView("day");
      state.setAnchor(date);
    },
    [state.setView, state.setAnchor],
  );

  const onZoomBy = useCallback(
    (delta: number) => {
      state.setZoom(state.zoom + delta * 8);
    },
    [state.zoom, state.setZoom],
  );

  const panelView = state.view === "agenda" ? "list" : state.view;
  const sidePanelElement = useMemo(
    () => (
      <CalendarSidePanel
        anchor={state.anchor}
        view={panelView}
        mode={state.mode}
        minDuration={minDuration}
        showRecurring={showRecurring}
        onSelectDate={state.setAnchor}
        onModeChange={state.setMode}
        onMinDurationChange={setMinDuration}
        onOwnerIdsChange={setSelectedOwnerIds}
        onShowRecurringChange={setShowRecurring}
      />
    ),
    [
      state.anchor,
      panelView,
      state.mode,
      minDuration,
      showRecurring,
      state.setAnchor,
      state.setMode,
    ],
  );
  useSidePanel(sidePanelElement);

  const panelBase = {
    range: paddedRange,
    anchor: effectiveAnchor,
    zoom: state.zoom,
    displayMode: state.mode,
    events,
    loading,
    error,
    onEventClick,
  };

  const monthPanelBase = { ...panelBase, events };

  const navDisabled = loading || state.mode !== "scope";

  return (
    <div className="flex h-full flex-col" data-testid="schedule-timeline">
      <ScheduleToolbar
        view={state.view}
        mode={state.mode}
        anchor={state.anchor}
        effectiveAnchor={effectiveAnchor}
        navDisabled={navDisabled}
        onPrev={() => state.shiftAnchor(-1)}
        onNext={() => state.shiftAnchor(1)}
        onToday={() => state.goToToday()}
        onViewChange={state.setView}
        onModeChange={state.setMode}
      />
      <div className="flex-1 overflow-hidden">
        {state.view === "day" && (
          <DayPanel {...panelBase} onSlotCreate={onSlotCreate} onZoomBy={onZoomBy} />
        )}
        {state.view === "week" && (
          <WeekPanel {...panelBase} onSlotCreate={onSlotCreate} onZoomBy={onZoomBy} />
        )}
        {state.view === "month" && (
          <MonthPanel {...monthPanelBase} onSlotCreate={onSlotCreate} onDayClick={onMonthDayClick} />
        )}
        {state.view === "year" && <YearPanel {...panelBase} />}
        {state.view === "agenda" && <AgendaPanel {...panelBase} />}
      </div>
    </div>
  );
}
