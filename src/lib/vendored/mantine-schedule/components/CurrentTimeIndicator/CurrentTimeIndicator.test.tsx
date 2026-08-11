// @vitest-environment jsdom
import { renderWithMantine } from "@/test/render-with-mantine";
import "@testing-library/jest-dom/vitest";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";

describe("CurrentTimeIndicator", () => {
  it("reveals the wall-clock position after mount", async () => {
    const getCurrentTime = vi.fn(() => new Date("2026-08-11T10:30:00+09:00"));
    const { container } = renderWithMantine(
      <CurrentTimeIndicator
        getCurrentTime={getCurrentTime}
        startTime="00:00"
        endTime="23:59"
      />,
    );

    await waitFor(() => expect(getCurrentTime).toHaveBeenCalled());
    expect(container.textContent).toContain("10:30");
    expect(container.querySelector('[class*="currentTimeIndicator"]')).toBeInTheDocument();
  });
});
