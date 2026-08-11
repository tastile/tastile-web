// src/components/schedule/DayPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { getDayViewWindow } from "@/lib/calendar/layout";
import { DayView, MobileMonthView } from "@/lib/vendored/mantine-schedule";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { buildLoadingDayEvents, toScheduleEvents } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";
import { useResponsiveBreakpoint } from "./useResponsiveBreakpoint";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  displayMode: DisplayMode;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
  onSlotCreate: (start: string, end: string) => void;
  onZoomBy: (delta: number) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD HH:mm:ss" in local time — the format the vendored view uses. */
function toLocalSlotString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Move an ISO instant by `shiftMs` while keeping it an ISO instant. */
function shiftIso(iso: string, shiftMs: number): string {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(t + shiftMs).toISOString();
}

function shiftEvent(e: CalendarEvent, shiftMs: number): CalendarEvent {
  if (shiftMs === 0 || e.allDay) return e;
  return { ...e, start: shiftIso(e.start, shiftMs), end: shiftIso(e.end, shiftMs) };
}

export function DayPanel({
  range,
  anchor,
  zoom,
  displayMode,
  events,
  loading,
  error,
  onEventClick,
  onSlotCreate,
  onZoomBy,
}: Props) {
  const breakpoint = useResponsiveBreakpoint();
  const { shiftMs, startTime, endTime, scrollTime } = getDayViewWindow(displayMode, anchor);
  // The grid is a fixed 24 h; modes shift the *time origin* instead of
  // changing which rows exist, so cross-midnight windows stay visible.
  // Only the rendered geometry is shifted — `payload` keeps the real event
  // so click-to-edit round-trips the true instant.
  //
  // While loading, swap real events for placeholder shells with a
  // sentinel title so the same ScheduleEvent pipeline positions them
  // at realistic times of the day. renderEventBody detects the sentinel
  // and substitutes a Skeleton card of the same shape.
  const loadingEvents = useMemo(
    () => (loading ? buildLoadingDayEvents(anchor, shiftMs) : []),
    [loading, anchor, shiftMs],
  );
  const realScheduleEvents = useMemo(
    () =>
      events.flatMap((e) => toScheduleEvents(shiftEvent(e, shiftMs)).map((se) => ({ ...se, payload: e }))),
    [events, shiftMs],
  );
  const scheduleEvents = loading ? loadingEvents.flatMap(toScheduleEvents) : realScheduleEvents;
  // The mobile fallback buckets by calendar day and has no virtual-day
  // notion, so it must see real times.
  const mobileEvents = shiftMs === 0 ? scheduleEvents : events.flatMap(toScheduleEvents);
  const containerRef = useRef<HTMLDivElement>(null);
  const onZoomByRef = useRef(onZoomBy);

  // Zoom via Ctrl+wheel — capture phase on container so it fires before ScrollArea
  useEffect(() => {
    onZoomByRef.current = onZoomBy;
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomByRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", handler, { capture: true });
      onZoomByRef.current = onZoomBy;
    };
  }, [onZoomBy]);

  void range;

  // Grid slot ("YYYY-MM-DD HH:mm:ss", virtual) → real local slot string.
  const unshiftSlot = (slot: string) =>
    shiftMs === 0 ? slot : toLocalSlotString(new Date(new Date(slot).getTime() - shiftMs));

  // Gutter labels show the *real* time behind each virtual row, with a date
  // prefix on the row where the real day rolls over.
  const slotLabel = (date: string) => {
    const real = new Date(new Date(date).getTime() - shiftMs);
    const hhmm = `${pad(real.getHours())}:${pad(real.getMinutes())}`;
    return real.getHours() === 0 && real.getMinutes() === 0
      ? `${real.getMonth() + 1}/${real.getDate()} ${hhmm}`
      : hhmm;
  };

  if (breakpoint === "mobile") {
    const renderMobileEvent = (e: ScheduleEventData) => {
      const body = renderEventBody(e as ScheduleEventData<CalendarEvent>, "month");
      // biome-ignore lint/complexity/noUselessFragments: RenderEvent contract requires ReactElement, not null
      return (body as React.ReactElement) ?? <></>;
    };

    return (
      <div className="relative h-full" data-testid="day-panel-mobile" data-loading={loading && events.length === 0 ? true : undefined}>
        {error && <ErrorBanner error={error} />}
        <MobileMonthView
          date={anchor}
          events={mobileEvents}
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          renderEvent={renderMobileEvent}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full"
      data-testid="day-panel"
      data-loading={loading && events.length === 0 ? true : undefined}
    >
      {error && <ErrorBanner error={error} />}
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
        onTimeSlotClick={({ slotStart, slotEnd }) =>
          onSlotCreate(unshiftSlot(slotStart), unshiftSlot(slotEnd))
        }
        onSlotDragEnd={(s, e) => onSlotCreate(unshiftSlot(s), unshiftSlot(e))}
        renderEventBody={(e) => renderEventBody(e, "day")}
        slotLabelFormat={slotLabel}
        getCurrentTime={() => new Date(Date.now() + shiftMs)}
        scrollAreaProps={{ style: { height: "100%" } }}
        startScrollTime={scrollTime}
        style={{ "--day-view-slot-height": `${zoom}px` } as React.CSSProperties}
      />
    </div>
  );
}
