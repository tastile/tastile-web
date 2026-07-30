// src/components/schedule/ScheduleTimeline.tsx
"use client";

import { CalendarSidePanel } from "@/components/panels/CalendarSidePanel";
import { getModeRange } from "@/lib/calendar/layout";
import { useSidePanel } from "@/lib/context/side-panel-context";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useEvents } from "@/lib/hooks/calendar/use-events";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useCallback, useMemo, useState } from "react";
import { AgendaPanel } from "./AgendaPanel";
import { DayPanel } from "./DayPanel";
import { MonthPanel } from "./MonthPanel";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { WeekPanel } from "./WeekPanel";
import { YearPanel } from "./YearPanel";
import { useTimelineState } from "./useTimelineState";

type Props = {
  initialView: "day" | "week" | "month" | "year" | "agenda";
};

export function ScheduleTimeline({ initialView }: Props) {
  const state = useTimelineState(initialView);
  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const effectiveAnchor = state.effectiveAnchor;
  const range = useMemo(() => {
    // getModeRange only supports {day, week, month, year}; agenda uses a
    // day-scoped range anchored on the effective date.
    if (state.view === "agenda") {
      const day = effectiveAnchor;
      const start = new Date(`${day}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 3);
      const end = new Date(`${day}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 4);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
      };
    }
    return getModeRange(state.view, state.mode, effectiveAnchor, tzOffsetMinutes);
  }, [state.view, state.mode, effectiveAnchor, tzOffsetMinutes]);

  // Pad range so events cover the full visible grid (Month = 6×7 = 42d, Year = 12mo)
  const paddedRange = useMemo(() => {
    if (state.view === "month") {
      const start = new Date(range.start);
      start.setDate(start.getDate() - 7);
      const end = new Date(range.end);
      end.setDate(end.getDate() + 7);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    if (state.view === "year") {
      const y = Number.parseInt(range.start.slice(0, 4), 10);
      return { start: `${y - 1}-01-01`, end: `${y + 2}-01-01` };
    }
    if (state.view === "agenda") {
      const end = new Date(range.end);
      end.setDate(end.getDate() + 90);
      return { start: range.start, end: end.toISOString().slice(0, 10) };
    }
    return range;
  }, [range, state.view]);

  const { events, loading, error } = useEvents(paddedRange);
  const openEdit = useQuickCreateStore((s) => s.openEdit);
  const openCreate = useQuickCreateStore((s) => s.openCreate);
  const loadFromRecurringTile = useQuickCreateStore((s) => s.loadFromRecurringTile);

  const onEventClick = useCallback(
    (event: CalendarEvent) => {
      // Strip ":cursor" suffix that occurrence IDs may carry (see CalendarMain.handleEditEvent:358)
      const colon = event.id.indexOf(":");
      const sourceId = colon > 0 ? event.id.slice(0, colon) : event.id;
      if (event.source?.kind === 1 && event.tileId) {
        loadFromRecurringTile(event.tileId);
        return;
      }
      openEdit(sourceId, event.tileId ?? null);
    },
    [loadFromRecurringTile, openEdit],
  );

  const onSlotCreate = useCallback(
    (start: string, end: string) => {
      openCreate({ initialAllDay: false });
      void start;
      void end;
    },
    [openCreate],
  );

  const onMonthDayClick = useCallback(
    (date: string) => {
      state.setView("day");
      state.setAnchor(date);
    },
    [state],
  );

  // Side panel: register CalendarSidePanel with URL-synchronised state.
  // The element must be reference-stable across renders (useMemo).
  // CalendarSidePanel uses "list" for what we now call "agenda".
  const [minDuration, setMinDuration] = useState(0);
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
      />
    ),
    [state.anchor, panelView, state.mode, minDuration, state.setAnchor, state.setMode],
  );
  useSidePanel(sidePanelElement);

  // Base props every panel receives.
  const panelBase = {
    range: paddedRange,
    anchor: effectiveAnchor,
    zoom: state.zoom,
    events,
    loading,
    error,
    onEventClick,
  };

  return (
    <div className="flex h-full flex-col" data-testid="schedule-timeline">
      <ScheduleToolbar
        view={state.view}
        mode={state.mode}
        anchor={state.anchor}
        zoom={state.zoom}
        navDisabled={loading || state.mode !== "scope"}
        onPrev={() => state.shiftAnchor(-1)}
        onNext={() => state.shiftAnchor(1)}
        onToday={() => state.goToToday()}
        onViewChange={state.setView}
        onModeChange={state.setMode}
        onZoomChange={state.setZoom}
      />
      <div className="flex-1 overflow-auto">
        {state.view === "day" && <DayPanel {...panelBase} onSlotCreate={onSlotCreate} />}
        {state.view === "week" && <WeekPanel {...panelBase} onSlotCreate={onSlotCreate} />}
        {state.view === "month" && (
          <MonthPanel {...panelBase} onSlotCreate={onSlotCreate} onDayClick={onMonthDayClick} />
        )}
        {state.view === "year" && <YearPanel {...panelBase} />}
        {state.view === "agenda" && <AgendaPanel {...panelBase} />}
      </div>
      <button
        type="button"
        data-testid="cal-create-fab"
        className="hidden"
        onClick={() => openCreate({})}
        aria-hidden
      />
    </div>
  );
}
