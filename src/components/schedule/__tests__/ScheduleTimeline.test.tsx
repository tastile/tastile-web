// src/components/schedule/__tests__/ScheduleTimeline.test.tsx
/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/timeline",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import { ScheduleTimeline } from "../ScheduleTimeline";

vi.mock("../DayPanel", () => ({ DayPanel: () => <div data-testid="day-panel" /> }));
vi.mock("../WeekPanel", () => ({ WeekPanel: () => <div data-testid="week-panel" /> }));
vi.mock("../MonthPanel", () => ({ MonthPanel: () => <div data-testid="month-panel" /> }));
vi.mock("../YearPanel", () => ({ YearPanel: () => <div data-testid="year-panel" /> }));
vi.mock("../AgendaPanel", () => ({ AgendaPanel: () => <div data-testid="agenda-panel" /> }));

vi.mock("@/lib/hooks/calendar/use-events", () => ({
  useEvents: () => ({
    events: [],
    loading: false,
    error: null,
    reload: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/quick-create-store", () => ({
  useQuickCreateStore: (selector: (s: unknown) => unknown) =>
    selector({ openEdit: vi.fn(), openCreate: vi.fn(), loadFromRecurringTile: vi.fn(), setField: vi.fn() }),
}));

vi.mock("@/lib/context/side-panel-context", () => ({
  useSidePanel: vi.fn(),
}));

vi.mock("@/components/panels/CalendarSidePanel", () => ({
  CalendarSidePanel: () => <div data-testid="calendar-side-panel" />,
}));

describe("ScheduleTimeline view selection", () => {
  it.each([
    ["day", "day-panel"],
    ["week", "week-panel"],
    ["month", "month-panel"],
    ["year", "year-panel"],
    ["agenda", "agenda-panel"],
  ] as const)("renders %s panel for view=%s", (view, testid) => {
    renderWithMantine(<ScheduleTimeline initialView={view} />);
    expect(screen.getByTestId(testid)).toBeInTheDocument();
  });

  it("renders ScheduleToolbar", () => {
    renderWithMantine(<ScheduleTimeline initialView="day" />);
    expect(screen.getByTestId("cal-prev")).toBeInTheDocument();
    expect(screen.getByTestId("cal-next")).toBeInTheDocument();
    expect(screen.getByTestId("cal-today")).toBeInTheDocument();
    expect(screen.getByTestId("cal-view-switcher")).toBeInTheDocument();
  });
});