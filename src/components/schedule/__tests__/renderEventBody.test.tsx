// src/components/schedule/__tests__/renderEventBody.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderEventBody } from "../renderEventBody";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import type { CalendarEvent } from "@/lib/domain/calendar";

// Stub lucide icons so tests don't try to render SVGs
vi.mock("lucide-react", () => ({
  CheckCircle: () => <span data-testid="icon-check" />,
}));

const baseEvent: CalendarEvent = {
  id: "evt-1",
  title: "Standup",
  description: null,
  location: null,
  start: "2026-07-30T09:00:00Z",
  end: "2026-07-30T10:00:00Z",
  allDay: false,
  color: "blue",
  recurrence: { frequency: "none" },
  icon: "check-circle",
  project: "alpha",
  tags: ["work", "sync"],
  memo: null,
  source: { kind: 0, detail: null },
  tileId: "tile-1",
  attendees: [],
  createdAt: "2026-07-30T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
};

function ev(_scope: "day" | "week" | "month" | "agenda"): ScheduleEventData<CalendarEvent> {
  return { id: baseEvent.id, title: baseEvent.title, start: new Date(baseEvent.start),
           end: new Date(baseEvent.end), color: "blue", variant: "light", display: "default",
           payload: baseEvent };
}

describe("renderEventBody", () => {
  it("emits day-event-${id} testid for day scope", () => {
    render(<>{renderEventBody(ev("day"), "day")}</>);
    expect(screen.getByTestId("day-event-evt-1")).toBeInTheDocument();
  });

  it("emits week-event-${id} for week scope", () => {
    render(<>{renderEventBody(ev("week"), "week")}</>);
    expect(screen.getByTestId("week-event-evt-1")).toBeInTheDocument();
  });

  it("emits month-event-${id} for month scope", () => {
    render(<>{renderEventBody(ev("month"), "month")}</>);
    expect(screen.getByTestId("month-event-evt-1")).toBeInTheDocument();
  });

  it("emits agenda-event-${id} for agenda scope", () => {
    render(<>{renderEventBody(ev("agenda"), "agenda")}</>);
    expect(screen.getByTestId("agenda-event-evt-1")).toBeInTheDocument();
  });

  it("renders title as text", () => {
    render(<>{renderEventBody(ev("day"), "day")}</>);
    expect(screen.getByText("Standup")).toBeInTheDocument();
  });

  it("renders icon when set", () => {
    render(<>{renderEventBody(ev("day"), "day")}</>);
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
  });

  it("renders project badge when set", () => {
    render(<>{renderEventBody(ev("day"), "day")}</>);
    expect(screen.getByTestId("event-project")).toBeInTheDocument();
  });

  it("renders tag dots when tags exist", () => {
    render(<>{renderEventBody(ev("day"), "day")}</>);
    expect(screen.getByTestId("event-tag-work")).toBeInTheDocument();
  });

  it("does not crash when icon name is not in Lucide", () => {
    const e: ScheduleEventData<CalendarEvent> = {
      ...ev("day"),
      payload: { ...baseEvent, icon: "non-existent-icon-xyz" },
    };
    render(<>{renderEventBody(e, "day")}</>);
    expect(screen.getByText("Standup")).toBeInTheDocument();
  });

  it("degrades gracefully without icon/project/tags", () => {
    const e: ScheduleEventData<CalendarEvent> = {
      ...ev("day"),
      payload: { ...baseEvent, icon: null, project: null, tags: [] },
    };
    render(<>{renderEventBody(e, "day")}</>);
    expect(screen.queryByTestId("event-project")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
  });
});
