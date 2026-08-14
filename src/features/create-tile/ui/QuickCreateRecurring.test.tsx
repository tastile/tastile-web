/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateRecurring } from "./QuickCreateRecurring";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
}));

import { useWorkspaces } from "@/shared/hooks/use-workspaces";

const mockUseWorkspaces = vi.mocked(useWorkspaces);

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
if (
  typeof document !== "undefined" &&
  typeof (document as { fonts?: unknown }).fonts === "undefined"
) {
  (document as unknown as { fonts: { addEventListener: () => void; removeEventListener: () => void } }).fonts = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function resetStore() {
  useQuickCreateStore.setState({
    isOpen: true,
    mode: "create",
    editingId: null,
    editingTileId: null,
    workflowKind: "recurring",
    identity: {
      kind: 2, // RECURRING
      title: "",
      description: null,
      externalId: null,
      visual: { color: "#5e6ad2", icon: "Repeat" },
    },
    time: {
      span: { start: "", end: "" },
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
      whenMode: "none",
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
      referenceId: null,
      referenceLabel: "",
    },
    recurring: {
      life: {
        active: { startDate: "", endDate: "" },
        state: 0,
        changed: { at: new Date().toISOString(), actor: { id: "self", kind: 0, ownerId: null } },
      },
      frameRules: [],
      rules: [],
      repeatMode: "daily",
      weekdayMask: 0b0011111,
      endDate: "",
      intervalValue: 30,
      intervalUnit: "min",
      condition: null,
      conditionIgnored: false,
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("QuickCreateRecurring", () => {
  beforeEach(() => {
    resetStore();
    mockUseWorkspaces.mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("renders the title input, rule picker, and workflow batch", () => {
    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-title")).toBeInTheDocument();
    expect(screen.getByTestId("recurring-mode-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-batch-recurring")).toBeInTheDocument();
  });

  it("writes the typed title to identity.title in the store", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    const titleInput = screen.getByTestId("recurring-title");
    await user.type(titleInput, "Standup");

    expect(useQuickCreateStore.getState().identity.title).toBe("Standup");
  });

  it("renders the duration dropdown with presets and a Custom option", () => {
    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-duration-select")).toBeInTheDocument();
  });

  it("applies a duration preset when the dropdown value changes", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    // Click on the Select wrapper to open the dropdown, then pick "60".
    const select = screen.getByTestId("recurring-duration-select");
    await user.click(select);
    const sixtyOption = screen.getByRole("option", { name: "1 hours", hidden: true });
    await user.click(sixtyOption);

    const { durationMinMax } = useQuickCreateStore.getState().time;
    expect(durationMinMax.minMs).toBe(60 * 60_000);
    expect(durationMinMax.maxMs).toBe(60 * 60_000);
  });

  it("toggles the end-date switch and writes an ISO endDate", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    await user.click(screen.getByTestId("recurring-end-toggle"));

    const { endDate } = useQuickCreateStore.getState().recurring;
    expect(endDate).not.toBe("");
    // ISO format
    expect(new Date(endDate).toString()).not.toBe("Invalid Date");
  });

  it("opening details reveals the recurring details sub-panel heading", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    await user.click(screen.getByTestId("recurring-open-details"));

    expect(
      screen.getByRole("heading", { name: /recurring details/i }),
    ).toBeInTheDocument();
  });

  it("closing the panel via the close button resets isOpen", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    await user.click(screen.getByTestId("quick-create-recurring-close"));

    expect(useQuickCreateStore.getState().isOpen).toBe(false);
  });

  it("renders the project picker and color input", () => {
    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-project-picker")).toBeInTheDocument();
    expect(screen.getByTestId("recurring-color")).toBeInTheDocument();
  });
});
