// src/components/schedule/__tests__/DayPanel.test.tsx
/** @vitest-environment jsdom */

import { fireEvent, screen } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { DayPanel } from './DayPanel';
import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";

// Stub out the vendored Mantine views
vi.mock("@/lib/vendored/mantine-schedule", () => ({
  DayView: ({
    onTimeSlotClick,
    onSlotDragEnd,
    onEventClick,
    events,
    slotLabelFormat,
    getCurrentTime,
  }: {
    onTimeSlotClick?: (arg: { slotStart: string; slotEnd: string }) => void;
    onSlotDragEnd?: (start: string, end: string) => void;
    onEventClick?: (e: { payload: CalendarEvent }) => void;
    events?: { id: string; start: string; end: string; payload: CalendarEvent }[];
    slotLabelFormat?: string | ((date: string) => string);
    getCurrentTime?: () => Date;
  }) => (
    <div data-testid="day-view">
      <button
        data-testid="day-slot-0900"
        onClick={() => onTimeSlotClick?.({ slotStart: "2026-07-30 09:00:00", slotEnd: "2026-07-30 09:30:00" })}
      >
        09:00
      </button>
      <button
        data-testid="day-drag-slot"
        onClick={() => onSlotDragEnd?.("2026-07-30 10:00:00", "2026-07-30 11:00:00")}
      >
        drag
      </button>
      <button
        data-testid="day-event"
        onClick={() =>
          onEventClick?.({
            payload: {
              id: "evt-1",
              title: "Test",
              allDay: false,
              start: "2026-07-30T09:00:00Z",
              end: "2026-07-30T10:00:00Z",
              source: { kind: 0, detail: null },
              tileId: "tile-1",
              color: "blue",
            } as CalendarEvent,
          })
        }
      >
        event
      </button>
      {/* Introspection hooks for the virtual-day mapping */}
      <div data-testid="grid-event-starts">{(events ?? []).map((e) => e.start).join("|")}</div>
      <div data-testid="grid-slot-label">
        {typeof slotLabelFormat === "function" ? slotLabelFormat("2026-07-30 09:00:00") : ""}
      </div>
      <div data-testid="grid-now">{getCurrentTime ? getCurrentTime().toISOString() : ""}</div>
      {(events ?? []).map((e) => (
        <button
          key={e.id}
          data-testid={`grid-event-${e.id}`}
          onClick={() => onEventClick?.({ payload: e.payload })}
        >
          {e.id}
        </button>
      ))}
    </div>
  ),
  MobileMonthView: ({ events }: { events?: { start: string }[] }) => (
    <div data-testid="mobile-month-view">{(events ?? []).map((e) => e.start).join("|")}</div>
  ),
}));

const bp = vi.hoisted(() => ({ current: "desktop" as "desktop" | "mobile" }));

vi.mock("./useResponsiveBreakpoint", () => ({
  useResponsiveBreakpoint: () => bp.current,
}));

vi.mock("./ErrorBanner", () => ({
  ErrorBanner: ({ error }: { error: Error | null }) =>
    error ? <div data-testid="error-banner">{error.message}</div> : null,
}));

vi.mock("./eventAdapter", () => ({
  // Echo the times it was handed so tests can observe the virtual-day shift.
  toScheduleEvents: (e: CalendarEvent) => [
    {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      color: "blue",
      variant: "light" as const,
      display: "default" as const,
      payload: e,
    },
  ],
  // Day view loading events: 5 sentinels at 9/13/14:30/17/19 local.
  // We return exactly one synthetic event per call so the test can
  // observe the synthetic flow into DayView's events prop.
  buildLoadingDayEvents: () => [
    {
      id: "__loading_day_synthetic",
      title: "__loading__",
      start: "2026-07-30T00:00:00.000Z",
      end: "2026-07-30T00:30:00.000Z",
      allDay: false,
      color: "gray",
      recurrence: { frequency: "none" },
      createdAt: "",
      updatedAt: "",
    },
  ],
  MONTH_LOADING_EVENT_TITLE: "__loading__",
}));

vi.mock("./renderEventBody", () => ({
  renderEventBody: () => <span>body</span>,
}));

const range: DisplayRange = { start: "2026-07-30", end: "2026-07-31" };

describe("DayPanel", () => {
  it("renders the DayView", () => {
    render(
      <DayPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={false}
        error={null}
        onEventClick={vi.fn()}
        onSlotCreate={vi.fn()}
        onZoomBy={vi.fn()}
        displayMode="scope"
      />,
    );
    expect(screen.getByTestId("day-view")).toBeInTheDocument();
  });

  describe("Ctrl+wheel zoom", () => {
    it("calls onZoomBy(+1) on Ctrl+wheel up", () => {
      const onZoomBy = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("day-panel");
      fireEvent.wheel(panel, { deltaY: -100, ctrlKey: true });
      expect(onZoomBy).toHaveBeenCalledWith(1);
    });

    it("calls onZoomBy(-1) on Ctrl+wheel down", () => {
      const onZoomBy = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("day-panel");
      fireEvent.wheel(panel, { deltaY: 100, ctrlKey: true });
      expect(onZoomBy).toHaveBeenCalledWith(-1);
    });

    it("does NOT call onZoomBy on plain wheel (no Ctrl)", () => {
      const onZoomBy = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("day-panel");
      fireEvent.wheel(panel, { deltaY: 100, ctrlKey: false });
      expect(onZoomBy).not.toHaveBeenCalled();
    });

    it("calls onZoomBy on Meta+wheel (Mac)", () => {
      const onZoomBy = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("day-panel");
      fireEvent.wheel(panel, { deltaY: -100, metaKey: true });
      expect(onZoomBy).toHaveBeenCalledWith(1);
    });
  });

  describe("slot click → onSlotCreate", () => {
    it("passes slot start/end from DayView to onSlotCreate", async () => {
      const onSlotCreate = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={onSlotCreate}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByTestId("day-slot-0900"));
      expect(onSlotCreate).toHaveBeenCalledWith("2026-07-30 09:00:00", "2026-07-30 09:30:00");
    });

    it("passes drag slot start/end to onSlotCreate", async () => {
      const onSlotCreate = vi.fn();
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={onSlotCreate}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByTestId("day-drag-slot"));
      expect(onSlotCreate).toHaveBeenCalledWith("2026-07-30 10:00:00", "2026-07-30 11:00:00");
    });
  });

  it("shows error banner when error is set", () => {
    render(
      <DayPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={false}
        error={new Error("boom")}
        onEventClick={vi.fn()}
        onSlotCreate={vi.fn()}
        onZoomBy={vi.fn()}
        displayMode="scope"
      />,
    );
    expect(screen.getByTestId("error-banner")).toHaveTextContent("boom");
  });

  it("marks the panel loading when loading=true", () => {
    render(
      <DayPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={true}
        error={null}
        onEventClick={vi.fn()}
        onSlotCreate={vi.fn()}
        onZoomBy={vi.fn()}
        displayMode="scope"
      />,
    );
    expect(screen.getByTestId("day-panel")).toHaveAttribute("data-loading");
  });

  it("injects synthetic skeleton events into the grid while loading", () => {
    render(
      <DayPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={true}
        error={null}
        onEventClick={vi.fn()}
        onSlotCreate={vi.fn()}
        onZoomBy={vi.fn()}
        displayMode="scope"
      />,
    );
    // The mock adapter emits a synthetic event the DayView mock echoes
    // as a button with data-testid="grid-event-${id}".
    expect(screen.getByTestId("grid-event-__loading_day_synthetic")).toBeInTheDocument();
  });

  it("does NOT inject skeleton events once real events arrive", () => {
    const cached = {
      id: "evt-cached",
      title: "Cached event",
      allDay: false,
      start: "2026-07-30T09:00:00Z",
      end: "2026-07-30T10:00:00Z",
      source: { kind: 0, detail: null },
      tileId: "tile-cached",
      color: "blue",
    } as CalendarEvent;
    render(
      <DayPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[cached]}
        loading={true}
        error={null}
        onEventClick={vi.fn()}
        onSlotCreate={vi.fn()}
        onZoomBy={vi.fn()}
        displayMode="scope"
      />,
    );
    expect(screen.queryByTestId("grid-event-__loading_day_synthetic")).not.toBeInTheDocument();
    expect(screen.getByTestId("grid-event-evt-cached")).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Virtual-day mapping: "around"/"future" shift the time origin instead of
  // shrinking the grid, so the 24 h window can cross midnight.
  // ───────────────────────────────────────────────────────────────────────
  describe("around mode — virtual-day shift", () => {
    // 2026-07-30 03:20 local. around origin = 2026-07-29 15:00 local,
    // anchor midnight = 2026-07-30 00:00 local ⇒ shiftMs = +9 h.
    const now = new Date(2026, 6, 30, 3, 20, 0, 0);
    // A real event on the *previous* calendar day — invisible before the fix.
    const prevDayEvent = {
      id: "evt-prev",
      title: "Yesterday evening",
      allDay: false,
      start: new Date(2026, 6, 29, 18, 0, 0, 0).toISOString(),
      end: new Date(2026, 6, 29, 19, 0, 0, 0).toISOString(),
      source: { kind: 0, detail: null },
      tileId: "tile-1",
      color: "blue",
    } as CalendarEvent;

    const renderAround = (props: Partial<React.ComponentProps<typeof DayPanel>> = {}) =>
      render(
        <DayPanel
          range={range}
          anchor="2026-07-30"
          zoom={56}
          events={[prevDayEvent]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={vi.fn()}
          displayMode="around"
          {...props}
        />,
      );

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      bp.current = "desktop";
    });

    afterEach(() => {
      vi.useRealTimers();
      bp.current = "desktop";
    });

    it("shifts a previous-day event into the grid so it is visible", () => {
      renderAround();
      // 2026-07-29 18:00 + 9 h ⇒ 2026-07-30 03:00 local, inside the grid day.
      expect(screen.getByTestId("grid-event-starts")).toHaveTextContent(
        new Date(2026, 6, 30, 3, 0, 0, 0).toISOString(),
      );
    });

    it("keeps the REAL event on payload so click-to-edit round-trips", () => {
      const onEventClick = vi.fn();
      renderAround({ onEventClick });

      fireEvent.click(screen.getByTestId("grid-event-evt-prev"));

      expect(onEventClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "evt-prev", start: prevDayEvent.start }),
      );
    });

    it("unshifts slot interactions back to real time", () => {
      const onSlotCreate = vi.fn();
      renderAround({ onSlotCreate });

      fireEvent.click(screen.getByTestId("day-slot-0900"));

      // virtual 09:00 − 9 h ⇒ real 00:00 on the anchor day
      expect(onSlotCreate).toHaveBeenCalledWith("2026-07-30 00:00:00", "2026-07-30 00:30:00");
    });

    it("labels gutter rows with real time, dating the midnight ro