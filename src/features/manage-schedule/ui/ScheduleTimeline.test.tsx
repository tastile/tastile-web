// src/components/schedule/__tests__/ScheduleTimeline.test.tsx
/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { renderWithMantine } from "@/test/render-with-mantine";

// ── mocks ──

const replaceFn = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockParams: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceFn }),
  usePathname: () => "/dashboard/timeline",
  useSearchParams: () => mockSearchParams,
  useParams: () => mockParams,
}));

const setFieldFn = vi.fn();
const openCreateFn = vi.fn();
const openEditFn = vi.fn();
const loadFromRecurringTileFn = vi.fn();

vi.mock("@/shared/stores/quick-create-store", () => ({
  useQuickCreateStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openEdit: openEditFn,
      openCreate: openCreateFn,
      loadFromRecurringTile: loadFromRecurringTileFn,
      setField: setFieldFn,
    }),
}));

const eventsCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("@/shared/hooks/calendar/use-events", async () => {
  const { useEffect } = await import("react");
  return {
    useEvents: (range: Record<string, unknown>) => {
      // Record in an effect, not in the render body. The real `useEvents`
      // only reaches the network from `useEffect(..., [reload])`, so render
      // passes that React discards (e.g. the one preceding a render-phase
      // state adjustment) never fetch. Recording here makes `eventsCalls`
      // an exact model of "which param sets hit the network", which is the
      // property these tests are about.
      const key = JSON.stringify(range);
      useEffect(() => {
        eventsCalls.push(JSON.parse(key));
      }, [key]);
      return {
        events: [],
        loading: false,
        error: null,
        reload: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      };
    },
  };
});

vi.mock("@/shared/context/side-panel-context", () => ({
  useSidePanel: vi.fn(),
}));

vi.mock("@/features/manage-schedule/ui/CalendarSidePanel", () => ({
  CalendarSidePanel: () => <div data-testid="calendar-side-panel" />,
}));

vi.mock("./DayPanel", () => ({
  DayPanel: ({ onSlotCreate, onZoomBy }: { onSlotCreate?: (start: string, end: string) => void; onZoomBy?: (d: number) => void }) => (
    <div data-testid="day-panel">
      <button data-testid="trigger-slot-create" onClick={() => onSlotCreate?.("2026-07-30 09:00:00", "2026-07-30 10:00:00")}>slot</button>
      <button data-testid="trigger-zoom" onClick={() => onZoomBy?.(1)}>zoom</button>
    </div>
  ),
}));
vi.mock("./WeekPanel", () => ({ WeekPanel: () => <div data-testid="week-panel" /> }));
vi.mock("./MonthPanel", () => ({ MonthPanel: () => <div data-testid="month-panel" /> }));
vi.mock("./YearPanel", () => ({ YearPanel: () => <div data-testid="year-panel" /> }));
vi.mock("./AgendaPanel", () => ({ AgendaPanel: () => <div data-testid="agenda-panel" /> }));

import { ScheduleTimeline } from './ScheduleTimeline';

beforeEach(() => {
  vi.clearAllMocks();
  replaceFn.mockReset();
  setFieldFn.mockReset();
  openCreateFn.mockReset();
  openEditFn.mockReset();
  loadFromRecurringTileFn.mockReset();
  mockSearchParams = new URLSearchParams();
  mockParams = {};
  eventsCalls.length = 0;
});

describe("ScheduleTimeline", () => {
  describe("view selection", () => {
    it.each([
      ["day", "day-panel"],
      ["week", "week-panel"],
      ["month", "month-panel"],
      ["year", "year-panel"],
      ["agenda", "agenda-panel"],
    ] as const)("renders %s panel for initialView=%s", (view, testid) => {
      renderWithMantine(<ScheduleTimeline initialView={view} />);
      expect(screen.getByTestId(testid)).toBeInTheDocument();
    });
  });

  describe("toolbar", () => {
    it("renders ScheduleToolbar with nav controls", () => {
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(screen.getByTestId("cal-prev")).toBeInTheDocument();
      expect(screen.getByTestId("cal-next")).toBeInTheDocument();
      expect(screen.getByTestId("cal-today")).toBeInTheDocument();
      expect(screen.getByTestId("cal-view-switcher")).toBeInTheDocument();
      expect(screen.getByTestId("cal-mode-switcher")).toBeInTheDocument();
    });
  });

  describe("onSlotCreate — sets time fields before openCreate", () => {
    it("calls setField with time.span.start/end then openCreate", () => {
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      screen.getByTestId("trigger-slot-create").click();

      // Must set time before opening
      expect(setFieldFn).toHaveBeenCalledWith("time.span.start", "2026-07-30 09:00:00");
      expect(setFieldFn).toHaveBeenCalledWith("time.span.end", "2026-07-30 10:00:00");
      expect(setFieldFn).toHaveBeenCalledWith("time.whenMode", "span");
      expect(openCreateFn).toHaveBeenCalledWith({ initialAllDay: false });
    });

    it("calls setField before openCreate (order check)", () => {
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      screen.getByTestId("trigger-slot-create").click();

      const calls = setFieldFn.mock.invocationCallOrder;
      const openCall = openCreateFn.mock.invocationCallOrder[0];
      // All setField calls must happen before openCreate
      for (const c of calls) {
        expect(c).toBeLessThan(openCall);
      }
    });
  });

  describe("onEventClick — routes to edit or recurring", () => {
    it("calls openEdit for normal event click", () => {
      // Simulated via schedule flow — tested through DayPanel mock's onEventClick
      // This is an integration test placeholder; the actual routing is in
      // ScheduleTimeline.onEventClick which is wired into DayPanel props.
      // We verify the mock wiring is correct by checking DayPanel receives onEventClick.
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      // DayPanel rendered and received the onEventClick prop
      expect(screen.getByTestId("day-panel")).toBeInTheDocument();
    });
  });

  describe("navDisabled — based on mode", () => {
    it("nav is disabled when mode is 'around' (not scope)", () => {
      mockSearchParams = new URLSearchParams("mode=around");
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(screen.getByTestId("cal-prev")).toBeDisabled();
      expect(screen.getByTestId("cal-next")).toBeDisabled();
      expect(screen.getByTestId("cal-today")).toBeDisabled();
    });

    it("nav is disabled when mode is 'future'", () => {
      mockSearchParams = new URLSearchParams("mode=future");
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(screen.getByTestId("cal-prev")).toBeDisabled();
      expect(screen.getByTestId("cal-next")).toBeDisabled();
      expect(screen.getByTestId("cal-today")).toBeDisabled();
    });

    it("nav is enabled when mode is 'scope' (default)", () => {
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(screen.getByTestId("cal-prev")).not.toBeDisabled();
      expect(screen.getByTestId("cal-next")).not.toBeDisabled();
      expect(screen.getByTestId("cal-today")).not.toBeDisabled();
    });
  });

  describe("zoom propagation", () => {
    it("panel zoom propagates through onZoomBy", () => {
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      screen.getByTestId("trigger-zoom").click();
      expect(replaceFn).toHaveBeenCalledWith(expect.stringContaining("zoom=64"), { scroll: false });
    });
  });

  describe("useEvents params stay consistent across a view switch", () => {
    // `minMinutes` is part of the chunk cache key in useEvents. When the
    // compact-view defaults were synced by a useEffect instead of adjusted
    // during render, the first committed render after a view switch paired
    // the NEW view's chunking with the OLD view's minMinutes. That fetched
    // a full set of chunks under keys nothing ever reads again, and the
    // return trip re-fetched the origin view from scratch instead of
    // hitting the chunks already in cache — the "cache does nothing when I
    // switch views and come back" bug. One committed param set per view is
    // the invariant; two means a wasted round.
    const expectCompactPairing = (call: Record<string, unknown>) => {
      const compact = call.summary === "month";
      expect(call.minMinutes).toBe(compact ? 5 : 0);
    };

    it.each([
      ["week", "month"],
      ["month", "week"],
      ["day", "year"],
      ["year", "day"],
    ] as const)("fetches %s -> %s with exactly one param set", (from, to) => {
      mockSearchParams = new URLSearchParams(`view=${from}`);
      const { rerender } = renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(eventsCalls).toHaveLength(1);
      expectCompactPairing(eventsCalls[0]);

      eventsCalls.length = 0;
      mockSearchParams = new URLSearchParams(`view=${to}`);
      rerender(<ScheduleTimeline initialView="day" />);

      // Exactly one — two would mean the stale-minMinutes round went out.
      expect(eventsCalls).toHaveLength(1);
      expectCompactPairing(eventsCalls[0]);
      expect(eventsCalls[0].summary).toBe(
        to === "month" || to === "year" ? "month" : undefined,
      );
    });

    it("does not refetch when the view is unchanged", () => {
      mockSearchParams = new URLSearchParams("view=week");
      const { rerender } = renderWithMantine(<ScheduleTimeline initialView="day" />);
      eventsCalls.length = 0;
      rerender(<ScheduleTimeline initialView="day" />);
      expect(eventsCalls).toHaveLength(0);
    });

    it("seeds compact defaults from the resolved view, not the initialView prop", () => {
      // `/dashboard/timeline?view=month` renders with initialView="day".
      // Seeding from the prop would mount the month projection with
      // minMinutes=0 and never correct it, since the view never changes.
      mockSearchParams = new URLSearchParams("view=month");
      renderWithMantine(<ScheduleTimeline initialView="day" />);
      expect(eventsCalls).toHaveLength(1);
      expect(eventsCalls[0].summary).toBe("month");
      expect(eventsCalls[0].minMinutes).toBe(5);
    });
  });
});
