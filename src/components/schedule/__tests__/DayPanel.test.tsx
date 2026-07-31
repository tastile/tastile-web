// src/components/schedule/__tests__/DayPanel.test.tsx
/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { DayPanel } from "../DayPanel";
import type { CalendarEvent } from "@/lib/domain/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";

// Stub out the vendored Mantine views
vi.mock("@/lib/vendored/mantine-schedule", () => ({
  DayView: ({
    onTimeSlotClick,
    onSlotDragEnd,
    onEventClick,
  }: {
    onTimeSlotClick?: (arg: { slotStart: string; slotEnd: string }) => void;
    onSlotDragEnd?: (start: string, end: string) => void;
    onEventClick?: (e: { payload: CalendarEvent }) => void;
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
    </div>
  ),
  MobileMonthView: () => <div data-testid="mobile-month-view" />,
}));

vi.mock("../useResponsiveBreakpoint", () => ({
  useResponsiveBreakpoint: () => "desktop" as const,
}));

vi.mock("../ErrorBanner", () => ({
  ErrorBanner: ({ error }: { error: Error | null }) =>
    error ? <div data-testid="error-banner">{error.message}</div> : null,
}));

vi.mock("../LoadingOverlay", () => ({
  LoadingOverlay: ({
    loading,
    children,
  }: {
    loading: boolean;
    children: React.ReactNode;
  }) => {
    if (loading) return <div data-testid="day-loading">loading</div>;
    return <>{children}</>;
  },
}));

vi.mock("../eventAdapter", () => ({
  toScheduleEvents: (e: CalendarEvent) => [
    {
      id: e.id,
      title: e.title,
      start: "2026-07-30 09:00:00",
      end: "2026-07-30 10:00:00",
      color: "blue",
      variant: "light" as const,
      display: "default" as const,
      payload: e,
    },
  ],
}));

vi.mock("../renderEventBody", () => ({
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

  it("shows loading overlay when loading", () => {
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
    expect(screen.getByTestId("day-loading")).toBeInTheDocument();
  });
});
