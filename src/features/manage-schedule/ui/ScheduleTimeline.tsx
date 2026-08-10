// src/components/schedule/ScheduleTimeline.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import { CalendarSidePanel } from "@/features/manage-schedule/ui/CalendarSidePanel";
import { getModeRange } from "@/lib/calendar/layout";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useEvents } from "@/shared/hooks/calendar/use-events";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { useCallback, useMemo, useRef, useState } from "react";
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

  const [minDuration, setMinDuration] = useState(0);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[] | undefined>(undefined);

  const { events, loading, error } = useEvents({
    ...paddedRange,
    minMinutes: minDuration,
    ownerIds: selectedOwnerIds,
    maxWindowDays: state.view === "year" ? 31 : undefined,
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
        onSelectDate={state.setAnchor}
        onModeChange={state.setMode}
        onMinDurationChange={setMinDuration}
        onOwnerIdsChange={setSelectedOwnerIds}
      />
    ),
    [state.anchor, panelView, state.mode, minDuration, state.setAnchor, state.setMode],
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

  const navDisabled = loading || state.mode !== "scope";

  return (
    <div className="flex h-full flex-col" data-testid="schedule-timeline">
      <ScheduleToolbar
        view={state.view}
        mode={state.mode}
        anchor={state.anchor}
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
          <MonthPanel {...panelBase} onSlotCreate={onSlotCreate} onDayClick={onMonthDayClick} />
        )}
        {state.view === "year" && <YearPanel {...panelBase} />}
        {state.view === "agenda" && <AgendaPanel {...panelBase} />}
      </div>
    </div>
  );
}
