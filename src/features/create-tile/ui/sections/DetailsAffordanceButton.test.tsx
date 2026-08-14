/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { DetailsAffordanceButton } from "./DetailsAffordanceButton";

function resetStore() {
  useQuickCreateStore.setState({
    activePanel: "base",
  });
}

describe("DetailsAffordanceButton", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("renders the button with the given testId", () => {
    renderWithMantine(
      <DetailsAffordanceButton
        panelKey="task-details"
        labelKey="quickCreate.detailsTaskTitle"
        fallbackLabel="Task details"
        testId="details-test-id"
      />,
    );
    expect(screen.getByTestId("details-test-id")).toBeInTheDocument();
  });

  it("uses the English fallback when the i18n key resolves to empty", () => {
    renderWithMantine(
      <DetailsAffordanceButton
        panelKey="event-details"
        labelKey="quickCreate.__intentionally_missing__"
        fallbackLabel="Event details"
        testId="details-test-id"
      />,
    );
    expect(screen.getByRole("button", { name: "Event details" })).toBeInTheDocument();
  });

  it("writes the panelKey to activePanel when clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DetailsAffordanceButton
        panelKey="recurring-details"
        labelKey="quickCreate.detailsRecurringTitle"
        fallbackLabel="Recurring details"
        testId="details-test-id"
      />,
    );
    await user.click(screen.getByTestId("details-test-id"));
    expect(useQuickCreateStore.getState().activePanel).toBe("recurring-details");
  });
});
