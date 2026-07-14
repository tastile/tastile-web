"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  getWeekViewDates,
  layoutDayLanes,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useZoom } from "@/lib/hooks/use-zoom";
import { AllDayLane } from "./AllDayLane";
import { NowIndicator } from "./NowIndicator";
import { WeekViewFrame } from "./WeekViewFrame";
import { WeekViewTile } from "./WeekViewTile";

export interface WeekViewProps {
  anchor: string;
  mode: DisplayMode;
  tzOffset: number;
  events: CalendarEvent[];
  onCreateAtSlot?: (anchor: string, hour: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT_DEFAULT = 56;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function WeekView({
  anchor,
  mode,
  tzOffset,
  events,
  onCreateAtSlot,
  onEditEvent,
}: WeekViewProps) {
  const { ref: gridRef, zoom: hourHeight } = useZoom<HTMLDivElement>({
    initial: HOUR_HEIGHT_DEFAULT,
  });
  // Tick only drives the dynamic content (NowIndicator + todayLocal).
  // Frame props (weekDates, todayLocal) only change on day-rollover,
  // not on every tick — memoized WeekViewFrame skips re-render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const weekDates = useMemo(
    () => getWeekViewDates(mode, anchor, tzOffset),
    [mode, anchor, tzOffset],
  );

  // Day-of-week row uses local-time "today" (not UTC) to match the
  // device's clock; the time-grid below shifts per-day to local time
  // so the now-line lands on today's column.
  const todayLocal = useMemo(() => {
    const d = new Date(nowMs + tzOffset * 60_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }, [nowMs, tzOffset]);

  const perDay = useMemo(() => {
    const m = new Map<
      string,
      { allDay: CalendarEvent[]; timed: ReturnType<typeof layoutDayLanes> }
    >();
    for (const d of weekDates) {
      const dayEvents = events.filter((e) => eventSpansDay(e, d));
      m.set(d, {
        allDay: dayEvents.filter((e) => e.allDay),
        timed: layoutDayLanes(
          dayEvents.filter((e) => !e.allDay),
          d,
          hourHeight,
          tzOffset,
        ),
      });
    }
    return m;
  }, [events, weekDates, hourHeight, tzOffset]);

  return (
    <WeekViewFrame
      gridRef={gridRef}
      hourHeight={hourHeight}
      weekDates={weekDates}
      todayLocal={todayLocal}
      onCreateAtSlot={onCreateAtSlot}
      allDayArea={(d) => (
        <AllDayLane events={perDay.get(d)?.allDay ?? []} onEditEvent={onEditEvent} />
      )}
      eventsArea={(d) => {
        const day = perDay.get(d);
        return (
          <>
            {(day?.timed ?? []).map(({ event, top, height, laneIndex, laneCount }) => (
              <WeekViewTile
                key={event.id}
                event={event}
                top={top}
                height={height}
                laneIndex={laneIndex}
                laneCount={laneCount}
                tzOffset={tzOffset}
                onEditEvent={onEditEvent}
              />
            ))}
            <NowIndicator hourHeight={hourHeight} startHour={0} effectiveDay={d} />
          </>
        );
      }}
    />
  );
}
