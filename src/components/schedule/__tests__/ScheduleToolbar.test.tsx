/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

// src/components/schedule/__tests__/ScheduleToolbar.test.tsx

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { ScheduleToolbar } from "../ScheduleToolbar";

const handlers = {
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onToday: vi.fn(),
  onViewChange: vi.fn(),
  onModeChange: vi.fn(),
};

beforeEach(() => {
  Object.values(handlers).forEach((h) => h.mockReset());
});

const baseProps = {
  view: "day" as const,
  mode: "scope" as const,
  anchor: "2026-07-30",
  navDisabled: false,
  ...handlers,
};

describe("ScheduleToolbar", () => {
  it("renders view switcher with all 5 options", () => {
    renderWithMantine(<ScheduleToolbar {...baseProps} />);
    expect(screen.getByTestId("cal-view-day")).toBeInTheDocument();
    expect(screen.getByTestId("cal-view-week")).toBeInTheDocument();
    expect(screen.getByTestId("cal-view-month")).toBeInTheDocument();
    expect(screen.getByTestId("cal-view-year")).toBeInTheDocument();
    expect(screen.getByTestId("cal-view-agenda")).toBeInTheDocument();
  });

  it("calls onViewChange when a view is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ScheduleToolbar {...baseProps} />);
    await user.click(screen.getByTestId("cal-view-week"));
    expect(handlers.onViewChange).toHaveBeenCalledWith("week");
  });

  it("calls onPrev when prev button clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ScheduleToolbar {...baseProps} />);
    await user.click(screen.getByTestId("cal-prev"));
    expect(handlers.onPrev).toHaveBeenCalledTimes(1);
  });

  it("disables prev/next/today when navDisabled", () => {
    renderWithMantine(<ScheduleToolbar {...baseProps} navDisabled={true} />);
    expect(screen.getByTestId("cal-prev")).toBeDisabled();
    expect(screen.getByTestId("cal-next")).toBeDisabled();
    expect(screen.getByTestId("cal-today")).toBeDisabled();
  });

  it("renders mode switcher with 3 options", () => {
    renderWithMantine(<ScheduleToolbar {...baseProps} />);
    expect(screen.getByTestId("cal-mode-scope")).toBeInTheDocument();
    expect(screen.getByTestId("cal-mode-around")).toBeInTheDocument();
    expect(screen.getByTestId("cal-mode-future")).toBeInTheDocument();
  });
});
