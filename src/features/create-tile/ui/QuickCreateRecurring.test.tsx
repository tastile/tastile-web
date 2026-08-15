/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateRecurring } from "./QuickCreateRecurring";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
  orderWorkspaceTree: (items: unknown[]) =>
    (items as Array<{ id: string; display_name: string }>).map((w, depth) => ({
      workspace: w,
      depth,
    })),
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
      timeModel: "fixed_window",
      schedulableWindow: { start: "", end: "" },
      span: { start: "", end: "" },
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
      whenMode: "none",
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
      referenceId: null,
      referenceLabel: "",
      splitPolicy: "unsplit",
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
      monthlyKind: null,
      monthlyDayOfMonth: 1,
      monthlyWeekOfMonth: 1,
      monthlyWeekday: 0,
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("QuickCreateRecurring", () => {
  beforeEach(() => {
    // Pin the locale to English so the test stays decoupled from the
    // default ja locale; otherwise labels like "分割しない" don't match
    // the English assertions (e.g. /keep continuous/i).
    useLocaleStore.setState({ locale: "en" });
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
    // Mantine renders the Select's listbox with `display: none` even
    // after the toggle click in jsdom — the dropdown's options exist in
    // the DOM but aren't yet "accessible" by role. `hidden: true` is
    // required to reach them. To disambiguate from the
    // TimeSuggestionInput's "Custom…" option (same default label), pick
    // by value via getAllByRole + index.
    const sixtyOption = screen.getAllByRole("option", {
      name: "1 hours",
      hidden: true,
    })[0];
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

    // The sub-panel's heading has a stable `id` regardless of locale —
    // assert by id to avoid coupling the test to a specific translation.
    expect(
      document.getElementById("recurring-details-heading"),
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

  it("renders the shared MemoSection bound to meta.memo", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    const memo = screen.getByTestId("recurring-memo");
    await user.type(memo, "lunch break");

    expect(useQuickCreateStore.getState().meta.memo).toBe("lunch break");
  });

  // ---- Duration custom-mode fix (same pattern as QuickCreateTask) ----

  it("reveals the manual NumberInput when the Custom option is selected", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    expect(screen.queryByTestId("recurring-duration-manual")).toBeNull();

    await user.click(screen.getByTestId("recurring-duration-select"));
    // The TimeSuggestionInput also renders a "Custom…" option, so pick
    // by value (the Duration Select uses "__custom_duration__") rather
    // than by name.
    const customOptions = screen.getAllByRole("option", {
      name: /custom/i,
      hidden: true,
    });
    const durationCustom = customOptions.find(
      (el) => el.getAttribute("value") === "__custom_duration__",
    );
    if (!durationCustom) throw new Error("Duration Custom option not found");
    await user.click(durationCustom);

    expect(screen.getByTestId("recurring-duration-manual")).toBeInTheDocument();
  });

  it("writes a typed custom value to the store and keeps the Select on the Custom sentinel", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    await user.click(screen.getByTestId("recurring-duration-select"));
    const customOptions = screen.getAllByRole("option", {
      name: /custom/i,
      hidden: true,
    });
    const durationCustom = customOptions.find(
      (el) => el.getAttribute("value") === "__custom_duration__",
    );
    if (!durationCustom) throw new Error("Duration Custom option not found");
    await user.click(durationCustom);

    const manual = screen.getByTestId("recurring-duration-manual");
    await user.clear(manual);
    await user.type(manual, "45");

    const { durationMinMax } = useQuickCreateStore.getState().time;
    expect(durationMinMax.minMs).toBe(45 * 60_000);
    expect(durationMinMax.maxMs).toBe(45 * 60_000);
    const select = screen.getByTestId("recurring-duration-select") as HTMLInputElement;
    expect(select.value).toMatch(/custom/i);
  });

  it("starts in custom mode when the store already holds a non-preset duration value", () => {
    act(() => {
      useQuickCreateStore.setState((s) => ({
        time: {
          ...s.time,
          durationMinMax: { minMs: 45 * 60_000, maxMs: 45 * 60_000 },
        },
      }));
    });

    renderWithMantine(<QuickCreateRecurring />);

    expect(screen.getByTestId("recurring-duration-manual")).toBeInTheDocument();
    const manual = screen.getByTestId("recurring-duration-manual") as HTMLInputElement;
    // NumberInput renders the suffix (" min") alongside the numeric
    // value; we only care about the numeric portion here.
    expect(manual.value).toMatch(/^45\b/);
  });

  it("stays in custom mode when the typed value happens to match a preset", async () => {
    // Once the user has explicitly entered Custom mode, typing a
    // preset value (e.g. 30) must NOT flip the Select back to the
    // preset. We track self-writes via a ref so the mirror effect
    // distinguishes this from an external template load.
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    await user.click(screen.getByTestId("recurring-duration-select"));
    const customOptions = screen.getAllByRole("option", {
      name: /custom/i,
      hidden: true,
    });
    const durationCustom = customOptions.find(
      (el) => el.getAttribute("value") === "__custom_duration__",
    );
    if (!durationCustom) throw new Error("Duration Custom option not found");
    await user.click(durationCustom);

    const manual = screen.getByTestId("recurring-duration-manual");
    await user.clear(manual);
    await user.type(manual, "30");

    const select = screen.getByTestId("recurring-duration-select") as HTMLInputElement;
    expect(select.value).toMatch(/custom/i);
    expect(useQuickCreateStore.getState().time.durationMinMax.minMs).toBe(30 * 60_000);
  });

  it("flips back to preset mode when an external store change seeds a preset", () => {
    // Reverse direction: store starts holding a custom (45) value, the
    // user is in custom mode, then a template load seeds a preset (60).
    // The Select must re-sync to the preset and hide the NumberInput.
    act(() => {
      useQuickCreateStore.setState((s) => ({
        time: {
          ...s.time,
          durationMinMax: { minMs: 45 * 60_000, maxMs: 45 * 60_000 },
        },
      }));
    });

    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-duration-manual")).toBeInTheDocument();

    // External store change (simulating a template load) — wrapped in
    // `act()` so React flushes the re-render + effect synchronously.
    act(() => {
      useQuickCreateStore.setState((s) => ({
        time: {
          ...s.time,
          durationMinMax: { minMs: 60 * 60_000, maxMs: 60 * 60_000 },
        },
      }));
    });

    expect(screen.queryByTestId("recurring-duration-manual")).toBeNull();
  });

  // ---- Daily time-window picker (start + end) ----
  //
  // The legacy form only had a single "Time of day" picker that
  // mirrored start → end. Almost no real use case fits that shape, so
  // the Daily form now exposes a real time window (start + end) and
  // leaves Weekly/Monthly on the legacy single-picker behaviour.

  it("renders both start and end time pickers in Daily mode", () => {
    // Default seed after resetStore is repeatMode: "daily".
    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-daily-start-time")).toBeInTheDocument();
    expect(screen.getByTestId("recurring-daily-end-time")).toBeInTheDocument();
  });

  it("writes end-time edits to the store (no auto-mirror to start)", async () => {
    // resetStore() leaves timeOfDayStart/End empty; seed a known start
    // so the render produces a real pickable end-time input.
    act(() => {
      useQuickCreateStore.setState((s) => ({
        time: {
          ...s.time,
          timeOfDayStart: "09:00",
          timeOfDayEnd: "10:00",
          timeOfDayMode: "range",
        },
      }));
    });

    const user = userEvent.setup();
    renderWithMantine(<QuickCreateRecurring />);

    const endPicker = screen.getByTestId("recurring-daily-end-time");
    await user.clear(endPicker);
    await user.type(endPicker, "17:00");
    // Tab/blur so the TimeSuggestionInput commits the normalized value.
    await user.tab();

    const t = useQuickCreateStore.getState().time;
    expect(t.timeOfDayEnd).toBe("17:00");
    // The end-time edit must not retroactively overwrite the start.
    expect(t.timeOfDayStart).toBe("09:00");
  });

  it("seeds the end-time to one hour after the start when the recurring workflow opens", () => {
    useQuickCreateStore.getState().reset();
    useQuickCreateStore.getState().openCreate({ workflow: "recurring" });
    const t = useQuickCreateStore.getState().time;
    expect(t.timeOfDayStart).toBe("09:00");
    expect(t.timeOfDayEnd).toBe("10:00");
  });

  it("renders the legacy single-picker for weekly mode (no end picker)", () => {
    act(() => {
      useQuickCreateStore.setState((s) => ({
        recurring: { ...s.recurring, repeatMode: "weekly" },
      }));
    });

    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-time-of-day")).toBeInTheDocument();
    expect(screen.queryByTestId("recurring-daily-end-time")).toBeNull();
  });

  // ---- Shared SubtasksSection (2026-08-15) ----

  it("renders the shared SubtasksSection in the main body", () => {
    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-subtasks")).toBeInTheDocument();
  });

  it("shows the empty hint when no subtasks exist on the Recurring form", () => {
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

    renderWithMantine(<QuickCreateRecurring />);
    expect(screen.getByTestId("recurring-subtasks")).toBeInTheDocument();
    expect(screen.getByTestId("recurring-subtasks-empty")).toBeInTheDocument();
  });
});
