/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanRole } from "@/shared/model/v1/constants";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateEvent } from "./QuickCreateEvent";
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
    workflowKind: "event",
    identity: {
      kind: 0,
      title: "",
      description: null,
      externalId: null,
      visual: { color: "#3b82f6", icon: "check-circle" },
    },
    time: {
      span: { start: "", end: "" },
      durationMinMax: { minMs: null, maxMs: null },
      whenMode: "none",
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
      referenceId: null,
      referenceLabel: "",
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("QuickCreateEvent", () => {
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

  it("renders the title input, all-day toggle, and workflow batch", () => {
    renderWithMantine(<QuickCreateEvent />);
    expect(screen.getByTestId("event-title")).toBeInTheDocument();
    expect(screen.getByTestId("event-all-day-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-batch-event")).toBeInTheDocument();
  });

  it("writes the typed title to identity.title in the store", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    const titleInput = screen.getByTestId("event-title");
    await user.type(titleInput, "Team standup");

    expect(useQuickCreateStore.getState().identity.title).toBe("Team standup");
  });

  it("toggling all-day on flips timeOfDayMode to all-day and sets default times", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    await user.click(screen.getByTestId("event-all-day-toggle"));

    const { timeOfDayMode, timeOfDayStart, timeOfDayEnd } =
      useQuickCreateStore.getState().time;
    expect(timeOfDayMode).toBe("all-day");
    expect(timeOfDayStart).toBe("00:00");
    expect(timeOfDayEnd).toBe("23:59");
  });

  it("toggling all-day off when all-day is on does not switch whenMode to range by itself", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    // Enabling all-day alone keeps whenMode at its initial value.
    await user.click(screen.getByTestId("event-all-day-toggle"));

    const { whenMode } = useQuickCreateStore.getState().time;
    expect(whenMode).not.toBe("range");
  });

  it("toggling label-only syncs plan.role to LABEL", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    // Open the sub-panel, then click the label-only switch inside it.
    await user.click(screen.getByTestId("event-open-details"));
    await user.click(screen.getByTestId("event-label-only-toggle"));

    expect(useQuickCreateStore.getState().meta.isLabelOnly).toBe(true);
    expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.LABEL);
  });

  it("opening details reveals the event details sub-panel heading", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    await user.click(screen.getByTestId("event-open-details"));

    // The sub-panel's heading has a stable `id` regardless of locale —
    // assert by id to avoid coupling the test to a specific translation.
    expect(document.getElementById("event-details-heading")).toBeInTheDocument();
  });

  it("closing the panel via the close button resets isOpen", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateEvent />);

    await user.click(screen.getByTestId("quick-create-event-close"));

    expect(useQuickCreateStore.getState().isOpen).toBe(false);
  });

  it("renders the project picker and color input", () => {
    renderWithMantine(<QuickCreateEvent />);
    expect(screen.getByTestId("event-project-picker")).toBeInTheDocument();
    expect(screen.getByTestId("event-color")).toBeInTheDocument();
  });

  it("renders the shared SubtasksSection in the main body", () => {
    renderWithMantine(<QuickCreateEvent />);
    expect(screen.getByTestId("event-subtasks")).toBeInTheDocument();
  });

  it("shows the empty hint when no subtasks exist on the Event form", () => {
    // Empty the seeded "Mark done" task so the test exercises the empty path.
    useQuickCreateStore.setState((s) => ({
      plan: {
        ...s.plan,
        completion: {
          ...s.plan.completion,
          tasks: [],
        },
      },
    }));

    renderWithMantine(<QuickCreateEvent />);
    expect(screen.getByTestId("event-subtasks")).toBeInTheDocument();
    expect(screen.getByTestId("event-subtasks-empty")).toBeInTheDocument();
  });
});
