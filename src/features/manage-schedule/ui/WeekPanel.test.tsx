// src/components/schedule/__tests__/WeekPanel.test.tsx
/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { WeekPanel } from './WeekPanel';
import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayRange } from "@/lib/calendar/layout";

vi.mock("@/lib/vendored/mantine-schedule", () => ({
  WeekView: ({
    onTimeSlotClick,
    onSlotDragEnd,
    events,
  }: {
    onTimeSlotClick?: (arg: { slotStart: string; slotEnd: string }) => void;
    onSlotDragEnd?: (start: string, end: string) => void;
    events?: { id: string }[];
  }) => (
    <div data-testid="week-view">
      <button
        data-testid="week-slot"
        onClick={() => onTimeSlotClick?.({ slotStart: "2026-07-30 14:00:00", slotEnd: "2026-07-30 15:00:00" })}
      >
        slot
      </button>
      <button
        data-testid="week-drag"
        onClick={() => onSlotDragEnd?.("2026-07-31 10:00:00", "2026-07-31 11:00:00")}
      >
        drag
      </button>
      {(events ?? []).map((e) => (
        <div key={e.id} data-testid={`week-event-${e.id}`} />
      ))}
    </div>
  ),
}));

vi.mock("../ErrorBanner", () => ({
  ErrorBanner: ({ error }: { error: Error | null }) =>
    error ? <div data-testid="error-banner">{error.message}</div> : null,
}));

vi.mock("./eventAdapter", () => ({
  toScheduleEvents: (e: CalendarEvent) => [
    {
      id: e.id,
      title: e.title,
      start: "2026-07-30 14:00:00",
      end: "2026-07-30 15:00:00",
      color: "blue",
      variant: "light" as const,
      display: "default" as const,
      payload: e,
    },
  ],
  buildLoadingWeekEvents: () => [
    {
      id: "__loading_week_synthetic",
      title: "__loading__",
      start: "2026-07-30T09:00:00.000Z",
      end: "2026-07-30T10:00:00.000Z",
      allDay: false,
      color: "gray",
      recurrence: { frequency: "none" },
      createdAt: "",
      updatedAt: "",
    },
  ],
  MONTH_LOADING_EVENT_TITLE: "__loading__",
}));

vi.mock("../renderEventBody", () => ({
  renderEventBody: () => <span>body</span>,
}));

const range: DisplayRange = { start: "2026-07-30", end: "2026-08-06" };

describe("WeekPanel", () => {
  it("renders the WeekView", () => {
    render(
      <WeekPanel
        range={range}
        anchor="2026-07-30"
        zoom={84}
        events={[]}
        loading={false}
        error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );
    expect(screen.getByTestId("week-view")).toBeInTheDocument();
  });

  describe("Ctrl+wheel zoom", () => {
    it("calls onZoomBy(+1) on Ctrl+wheel up", () => {
      const onZoomBy = vi.fn();
      render(
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("week-panel");
      fireEvent.wheel(panel, { deltaY: -100, ctrlKey: true });
      expect(onZoomBy).toHaveBeenCalledWith(1);
    });

    it("calls onZoomBy(-1) on Ctrl+wheel down", () => {
      const onZoomBy = vi.fn();
      render(
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("week-panel");
      fireEvent.wheel(panel, { deltaY: 100, ctrlKey: true });
      expect(onZoomBy).toHaveBeenCalledWith(-1);
    });

    it("does NOT call onZoomBy on plain wheel", () => {
      const onZoomBy = vi.fn();
      render(
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[]}
          loading={false}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={onZoomBy}
          displayMode="scope"
        />,
      );

      const panel = screen.getByTestId("week-panel");
      fireEvent.wheel(panel, { deltaY: 100, ctrlKey: false });
      expect(onZoomBy).not.toHaveBeenCalled();
    });
  });

  describe("loading skeleton gating", () => {
    it("marks the panel loading when loading=true and events is empty", () => {
      render(
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[]}
          loading={true}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );
      expect(screen.getByTestId("week-panel")).toHaveAttribute("data-loading");
    });

    it("injects synthetic skeleton events into the grid while loading", () => {
      render(
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[]}
          loading={true}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );
      expect(screen.getByTestId("week-event-__loading_week_synthetic")).toBeInTheDocument();
    });

    it("does NOT inject skeleton events once real events arrive (partial cache)", () => {
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
        <WeekPanel
          range={range}
          anchor="2026-07-30"
          zoom={84}
          events={[cached]}
          loading={true}
          error={null}
          onEventClick={vi.fn()}
          onSlotCreate={vi.fn()}
          onZoomBy={vi.fn()}
          displayMode="scope"
        />,
      );
      expect(screen.queryByTestId("week-event-__loading_week_synthetic")).not.toBeInTheDocument();
      expect(screen.getByTestId("week-event-evt-cached")).toBeInTheDocument();
    });
  });
});
