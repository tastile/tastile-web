// @vitest-environment jsdom
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { TileKind } from "@/shared/model/v1/constants";
import "@testing-library/jest-dom/vitest";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkflowValidation, WorkflowComposer } from "./WorkflowComposer";

const labels: Record<string, string> = {
  "quickCreate.workflowTitle": "Build your workflow",
  "quickCreate.workflowTitleLabel": "What do you want to do?",
  "quickCreate.workflowTiming": "How should it happen?",
  "quickCreate.workflowAnytime": "Anytime",
  "quickCreate.workflowAnytimeHint": "Available work",
  "quickCreate.workflowScheduled": "Schedule it",
  "quickCreate.workflowScheduledHint": "Calendar",
  "quickCreate.workflowRepeat": "Repeat it",
  "quickCreate.workflowRepeatHint": "Recurring",
  "quickCreate.workflowTypeLabel": "Item type",
  "quickCreate.workflowExecutable": "Executable task",
  "quickCreate.workflowTimeBlock": "Time block",
  "quickCreate.workflowRepeatPattern": "Repeat pattern",
  "quickCreate.workflowDaily": "Daily",
  "quickCreate.workflowWeekly": "Weekly",
  "quickCreate.workflowRecurringTime": "Time of day",
  "quickCreate.workflowRecurringTimeHint": "Each repeat runs at this time",
  "quickCreate.workflowRecurringTimeRequired": "Enter a time of day",
  "quickCreate.workflowWeekdays": "Run on",
  "quickCreate.workflowWeekdayRequired": "Choose a weekday",
  "quickCreate.weekdayMon": "Mon",
  "quickCreate.weekdayTue": "Tue",
  "quickCreate.weekdayWed": "Wed",
  "quickCreate.weekdayThu": "Thu",
  "quickCreate.weekdayFri": "Fri",
  "quickCreate.weekdaySat": "Sat",
  "quickCreate.weekdaySun": "Sun",
  "quickCreate.workflowStartRequired": "Choose a start date and time",
  "quickCreate.workflowDuration": "How long will it take?",
  "quickCreate.workflowMinutes": "min",
  "quickCreate.workflowSelected": "Selected",
  "quickCreate.workflowDetails": "Open detailed settings",
};

const t = (key: string) => labels[key] ?? key;

describe("WorkflowComposer", () => {
  beforeEach(() => {
    useQuickCreateStore.getState().reset();
  });

  it("starts with a plain-language workflow instead of structural vocabulary", () => {
    const { getByRole, getByTestId, queryByText } = render(
      <WorkflowComposer t={t} onOpenDetails={vi.fn()} />,
    );

    expect(getByRole("heading", { name: "Build your workflow" })).toBeVisible();
    expect(getByTestId("workflow-title-input")).toHaveAttribute(
      "placeholder",
      "What do you want to do?",
    );
    expect(queryByText(/FrameRule|ChangeSet|SourceTile/)).not.toBeInTheDocument();
  });

  it("switches the canonical store between one-time and repeating work", () => {
    const { getByTestId } = render(<WorkflowComposer t={t} onOpenDetails={vi.fn()} />);

    fireEvent.click(getByTestId("workflow-mode-repeat"));
    expect(useQuickCreateStore.getState().identity.kind).toBe(TileKind.RECURRING);
    expect(useQuickCreateStore.getState().recurring.repeatMode).toBe("daily");

    fireEvent.click(getByTestId("workflow-mode-anytime"));
    expect(useQuickCreateStore.getState().identity.kind).toBe(TileKind.PLACEMENT);
    expect(useQuickCreateStore.getState().recurring.repeatMode).toBe("once");
  });

  it("writes a duration choice into the existing v1 store", () => {
    const { getByTestId } = render(<WorkflowComposer t={t} onOpenDetails={vi.fn()} />);

    fireEvent.click(getByTestId("workflow-duration-25"));
    expect(useQuickCreateStore.getState().time.durationMinMax).toEqual({
      minMs: 25 * 60_000,
      maxMs: 25 * 60_000,
    });
    expect(getByTestId("workflow-duration-25")).toHaveAttribute("aria-checked", "true");
    expect(getByTestId("workflow-duration-25")).not.toHaveAttribute("aria-pressed");
  });

  it("supports duration preset radio keyboard navigation", () => {
    const { getByRole, getByTestId } = render(<WorkflowComposer t={t} onOpenDetails={vi.fn()} />);
    const first = getByTestId("workflow-duration-15");
    const second = getByTestId("workflow-duration-25");

    expect(getByRole("radiogroup", { name: "How long will it take?" })).toContainElement(first);
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveAttribute("aria-checked", "true");
    expect(second).not.toHaveAttribute("aria-pressed");
    expect(useQuickCreateStore.getState().time.durationMinMax).toEqual({
      minMs: 25 * 60_000,
      maxMs: 25 * 60_000,
    });
    expect(document.activeElement).toBe(second);
  });

  it("uses transparent, identical borders for selected and unselected selectors", () => {
    const { getByRole, getByTestId } = render(
      <WorkflowComposer t={t} onOpenDetails={vi.fn()} />,
    );

    const anytimeCard = getByTestId("workflow-mode-anytime").parentElement;
    const scheduledCard = getByTestId("workflow-mode-scheduled").parentElement;
    expect(anytimeCard?.className).toContain("border-transparent");
    expect(scheduledCard?.className).toContain("border-transparent");
    expect(anytimeCard?.className).not.toMatch(/border-(accent|border)(?:\s|$)/);
    expect(scheduledCard?.className).not.toMatch(/border-(accent|border)(?:\s|$)/);

    const executable = getByRole("radio", { name: "Executable task" });
    const label = getByRole("radio", { name: "Time block" });
    expect(executable.className).toContain("border-transparent");
    expect(label.className).toContain("border-transparent");
  });

  it("requires a concrete recurring time and synchronizes the canonical store", () => {
    const { getByTestId, getByRole } = render(
      <WorkflowComposer t={t} onOpenDetails={vi.fn()} />,
    );

    fireEvent.click(getByTestId("workflow-mode-repeat"));
    const timeInput = getByTestId("workflow-recurring-time-input");
    fireEvent.change(timeInput, { target: { value: "07:30" } });

    expect(timeInput).toHaveValue("07:30");
    expect(useQuickCreateStore.getState().time.timeOfDayStart).toBe("07:30");
    expect(new Date(useQuickCreateStore.getState().time.span.start).toISOString()).toBe(
      useQuickCreateStore.getState().time.span.start,
    );

    fireEvent.click(getByRole("radio", { name: "Weekly" }));
    expect(useQuickCreateStore.getState().recurring.repeatMode).toBe("weekly");
    expect(useQuickCreateStore.getState().recurring.weekdayMask).toBeGreaterThan(0);
  });

  it("normalizes stale recurring timing when switching back to anytime", () => {
    const { getByTestId } = render(
      <WorkflowComposer t={t} onOpenDetails={vi.fn()} />,
    );

    fireEvent.click(getByTestId("workflow-mode-repeat"));
    expect(useQuickCreateStore.getState().time.timeOfDayStart).toBe("09:00");
    fireEvent.click(getByTestId("workflow-mode-anytime"));

    expect(useQuickCreateStore.getState().recurring.repeatMode).toBe("once");
    expect(useQuickCreateStore.getState().time.timeOfDayStart).toBe("");
    expect(useQuickCreateStore.getState().time.span.start).toBe("");
  });

  it("exposes selected timing as an accessible radio group with arrow navigation", () => {
    const { getByRole } = render(<WorkflowComposer t={t} onOpenDetails={vi.fn()} />);

    const anytime = getByRole("radio", { name: /Anytime/ });
    const scheduled = getByRole("radio", { name: /Schedule it/ });
    const repeat = getByRole("radio", { name: /Repeat it/ });
    expect(getByRole("radiogroup", { name: "How should it happen?" })).toContainElement(anytime);
    expect(anytime).toBeChecked();
    expect(anytime).toHaveAttribute("aria-checked", "true");
    expect(scheduled).not.toBeChecked();
    expect(repeat).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(anytime, { key: "ArrowRight" });
    expect(scheduled).toBeChecked();
    expect(useQuickCreateStore.getState().time.whenMode).toBe("day");
    expect(document.activeElement).toBe(scheduled);

    fireEvent.keyDown(scheduled, { key: "End" });
    expect(repeat).toBeChecked();
    expect(useQuickCreateStore.getState().identity.kind).toBe(TileKind.RECURRING);
    expect(document.activeElement).toBe(repeat);
  });

  it("keeps the existing structural editor reachable", () => {
    const openDetails = vi.fn();
    const { getByRole } = render(<WorkflowComposer t={t} onOpenDetails={openDetails} />);

    fireEvent.click(getByRole("button", { name: "Open detailed settings" }));
    expect(openDetails).toHaveBeenCalledOnce();
  });
});

describe("workflow validation", () => {
  const base = {
    kind: TileKind.PLACEMENT,
    repeatMode: "once",
    whenMode: "none",
    spanStart: "",
    recurringTime: "",
    weekdayMask: 0,
  };

  it("requires a scheduled start date and time", () => {
    expect(getWorkflowValidation({ ...base, whenMode: "day" })).toEqual({
      path: "time.span.start",
      messageKey: "quickCreate.workflowStartRequired",
    });
    expect(getWorkflowValidation({ ...base, whenMode: "day", spanStart: "2026-08-11T09:00:00.000Z" })).toBeNull();
  });

  it("requires a daily time and a weekly weekday plus time", () => {
    expect(
      getWorkflowValidation({ ...base, kind: TileKind.RECURRING, repeatMode: "daily" }),
    ).toEqual({
      path: "time.timeOfDayStart",
      messageKey: "quickCreate.workflowRecurringTimeRequired",
    });
    expect(
      getWorkflowValidation({
        ...base,
        kind: TileKind.RECURRING,
        repeatMode: "weekly",
        recurringTime: "09:00",
      }),
    ).toEqual({
      path: "recurring.weekdayMask",
      messageKey: "quickCreate.workflowWeekdayRequired",
    });
    expect(
      getWorkflowValidation({
        ...base,
        kind: TileKind.RECURRING,
        repeatMode: "weekly",
        recurringTime: "09:00",
        weekdayMask: 1,
      }),
    ).toBeNull();
  });
});
