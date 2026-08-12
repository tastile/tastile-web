// src/components/schedule/__tests__/YearPanel.test.tsx
/** @vitest-environment jsdom */

import { renderWithMantine as render } from "@/test/render-with-mantine";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { YearPanel } from "./YearPanel";
import type { CalendarEvent } from "@/calendar/model/calendar";

vi.mock("@/lib/vendored/mantine-schedule", () => ({
  YearView: ({
    date,
    events,
  }: {
    date: string;
    events?: { id: string }[];
  }) => (
    <div data-testid="year-view" data-date={date}>
      {(events ?? []).map((e) => (
        <div key={e.id} data-testid={`year-event-${e.id}`} />
      ))}
    </div>
  ),
}));

vi.mock("./ErrorBanner", () => ({
  ErrorBanner: ({ error }: { error: Error | null }) =>
    error ? <div data-testid="error-banner">{error.message}</div> : null,
}));

vi.mock("./eventAdapter", () => ({
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
}));

describe("YearPanel", () => {
  const range = { start: "2026-01-01", end: "2026-12-31" };

  it("renders the YearView frame immediately even while loading with no events", () => {
    // Frame-first: the placement frame must be visible from the first
    // render, before any data arrives. A spinner or skeleton here would
    // delay the user seeing the calendar structure.
    render(
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={true}
        error={null}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("year-view")).toBeInTheDocument();
    expect(screen.getByTestId("year-view")).toHaveAttribute("data-date", "2026-07-30");
    expect(screen.queryByTestId("year-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("year-skeleton")).not.toBeInTheDocument();
  });

  it("fills in the YearView when events arrive during loading", () => {
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
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[cached]}
        loading={true}
        error={null}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("year-view")).toBeInTheDocument();
    expect(screen.getByTestId("year-event-evt-cached")).toBeInTheDocument();
  });

  it("renders the YearView when not loading", () => {
    render(
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={false}
        error={null}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("year-view")).toBeInTheDocument();
    expect(screen.queryByTestId("year-loading")).not.toBeInTheDocument();
  });

  it("marks the panel loading while loading is true", () => {
    render(
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={true}
        error={null}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("year-panel")).toHaveAttribute("data-loading");
  });

  it("does NOT mark the panel loading when loading is false", () => {
    render(
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={false}
        error={null}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("year-panel")).not.toHaveAttribute("data-loading");
  });

  it("shows error banner when error is set", () => {
    render(
      <YearPanel
        range={range}
        anchor="2026-07-30"
        zoom={56}
        events={[]}
        loading={false}
        error={new Error("boom")}
        displayMode="scope"
        onEventClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("error-banner")).toHaveTextContent("boom");
  });
});