import { describe, expect, it, beforeEach, vi } from "vitest";
import { hasTaskOrderCycle, selectIsDirty, tasksForSubmission, useQuickCreateStore } from "./quick-create-store";
import { PlanRole, RecurringState, TileKind } from "@/shared/model/v1/constants";

const reset = () => useQuickCreateStore.getState().reset();

describe("useQuickCreateStore", () => {
  beforeEach(() => {
    reset();
  });

  describe("initial state", () => {
    it("starts with default identity, plan, time, windows, recurring, advanced, meta", () => {
      const s = useQuickCreateStore.getState();
      expect(s.identity.kind).toBe(TileKind.PLACEMENT);
      expect(s.identity.title).toBe("");
      expect(s.identity.description).toBeNull();
      expect(s.identity.externalId).toBeNull();
      expect(s.identity.visual.color).toBe("#3b82f6");
      expect(s.identity.visual.icon).toBe("check-circle");
      expect(s.plan.role).toBe(PlanRole.EXECUTABLE);
      expect(s.plan.references).toEqual([]);
      expect(s.plan.completion).toBeDefined();
      expect(s.plan.planning.placementRules).toEqual([]);
      expect(s.plan.metrics).toEqual([]);
      expect(s.plan.decisions).toEqual([]);
      // A new tile is a floating target. The scheduler or an explicit fixed
      // placement choice supplies a span later; creation must not fabricate it.
      expect(s.time.span).toEqual({ start: "", end: "" });
      expect(s.initialAllDay).toBe(false);
      // No authored duration by default; the wire's requiredDuration() falls
      // back to a 5-min cap for the empty-span "place now" UX path.
      expect(s.time.durationMinMax).toEqual({ minMs: null, maxMs: null });
      expect(s.windows).toEqual([]);
      expect(s.recurring.life.active).toEqual({ startDate: "", endDate: "" });
      expect(s.recurring.life.state).toBe(RecurringState.ACTIVE);
      expect(s.recurring.frameRules).toEqual([]);
      expect(s.recurring.rules).toEqual([]);
      expect(s.advanced.changeSets).toEqual([]);
      expect(s.advanced.rules).toEqual([]);
      expect(s.meta.ownerSubjectId).toBeNull();
      expect(s.meta.memo).toBe("");
    });
  });

  describe("setField", () => {
    it("sets a top-level field", () => {
      useQuickCreateStore.getState().setField("identity", {
        title: "x",
        description: null,
        externalId: null,
        visual: { color: "red", icon: "star" },
      });
      expect(useQuickCreateStore.getState().identity.title).toBe("x");
      expect(useQuickCreateStore.getState().identity.visual.color).toBe("red");
    });

    it("sets a nested field via dot path", () => {
      useQuickCreateStore.getState().setField("identity.title", "hello");
      expect(useQuickCreateStore.getState().identity.title).toBe("hello");
    });

    it("sets a deeply nested field", () => {
      useQuickCreateStore.getState().setField("identity.visual.color", "#fff");
      expect(useQuickCreateStore.getState().identity.visual.color).toBe("#fff");
    });

    it("sets time fields", () => {
      useQuickCreateStore.getState().setField("time.span", {
        start: "2026-01-01T00:00:00Z",
        end: "2026-01-02T00:00:00Z",
      });
      expect(useQuickCreateStore.getState().time.span).toEqual({
        start: "2026-01-01T00:00:00Z",
        end: "2026-01-02T00:00:00Z",
      });
    });

    it("keeps the authored duration range represented by the completion requirement", () => {
      useQuickCreateStore.getState().setField("time.durationMinMax.minMs", 45 * 60_000);
      useQuickCreateStore.getState().setField("time.durationMinMax.maxMs", 75 * 60_000);

      expect(useQuickCreateStore.getState().plan.completion.timeRequirements[0].required).toEqual({
        minMs: 45 * 60_000,
        maxMs: 75 * 60_000,
      });
    });

    it("sets meta.memo", () => {
      useQuickCreateStore.getState().setField("meta.memo", "remember this");
      expect(useQuickCreateStore.getState().meta.memo).toBe("remember this");
    });
  });

  describe("reset", () => {
    it("clears all field state back to defaults", () => {
      const s = useQuickCreateStore.getState();
      s.setField("identity.title", "leak");
      s.setField("meta.memo", "leak");
      s.setField("plan.role", PlanRole.LABEL);
      s.reset();
      const r = useQuickCreateStore.getState();
      expect(r.identity.title).toBe("");
      expect(r.meta.memo).toBe("");
      expect(r.plan.role).toBe(PlanRole.EXECUTABLE);
    });

    it("clears the workflow default back to the original empty-span state", () => {
      useQuickCreateStore.getState().openCreate({ workflow: "event", initialAllDay: false });
      expect(useQuickCreateStore.getState().time.span.start).not.toBe("");
      useQuickCreateStore.getState().reset();
      expect(useQuickCreateStore.getState().time.span).toEqual({ start: "", end: "" });
    });
  });

  describe("openCreate per-workflow defaults", () => {
    it("seeds the Task form with today's local date and a 30-min duration", () => {
      const before = new Date();
      useQuickCreateStore.getState().openCreate({ workflow: "task" });
      const s = useQuickCreateStore.getState();
      expect(s.workflowKind).toBe("task");
      expect(s.initialAllDay).toBe(false);
      // Start is today's local midnight (ISO). The date part should equal today.
      const startDate = new Date(s.time.span.start);
      expect(Number.isNaN(startDate.getTime())).toBe(false);
      expect(startDate.getFullYear()).toBe(before.getFullYear());
      expect(startDate.getMonth()).toBe(before.getMonth());
      expect(startDate.getDate()).toBe(before.getDate());
      // Hour component should be 00:00 local.
      expect(startDate.getHours()).toBe(0);
      // durationMinMax matches the displayed "30 min" preset.
      expect(s.time.durationMinMax).toEqual({ minMs: 30 * 60_000, maxMs: 30 * 60_000 });
      expect(s.time.whenMode).toBe("day");
      // identity.kind stays PLACEMENT so the wire stays consistent with task submissions.
      expect(s.identity.kind).toBe(TileKind.PLACEMENT);
    });

    it("seeds the Event form with the next 15-min slot and a 90-min duration", () => {
      const before = new Date();
      useQuickCreateStore.getState().openCreate({ workflow: "event", initialAllDay: false });
      const s = useQuickCreateStore.getState();
      expect(s.workflowKind).toBe("event");
      expect(s.initialAllDay).toBe(false);
      const start = new Date(s.time.span.start);
      expect(Number.isNaN(start.getTime())).toBe(false);
      expect(start.getTime()).toBeGreaterThanOrEqual(before.getTime());
      // 15-minute grid alignment.
      expect(start.getMinutes() % 15).toBe(0);
      expect(start.getSeconds()).toBe(0);
      // End = start + 90 min.
      const end = new Date(s.time.span.end);
      expect(end.getTime() - start.getTime()).toBe(90 * 60_000);
      expect(s.time.durationMinMax).toEqual({ minMs: 90 * 60_000, maxMs: 90 * 60_000 });
      expect(s.time.whenMode).toBe("range");
      expect(s.time.timeOfDayMode).toBe("range");
    });

    it("seeds the Event form as all-day when initialAllDay=true", () => {
      useQuickCreateStore.getState().openCreate({ workflow: "event", initialAllDay: true });
      const s = useQuickCreateStore.getState();
      expect(s.initialAllDay).toBe(true);
      expect(s.time.timeOfDayMode).toBe("all-day");
      expect(s.time.timeOfDayStart).toBe("00:00");
      expect(s.time.timeOfDayEnd).toBe("23:59");
      // Span is "today at local midnight" for all-day events.
      const start = new Date(s.time.span.start);
      expect(start.getHours()).toBe(0);
    });

    it("seeds the Recurring form with repeatMode=once and an initial duration", () => {
      // Safer default per AGENTS feedback "ビュー切り替えで誤った操作で
      // 繰り返しを有効にしてしまった" — the user has to opt-in to a
      // recurring schedule from the segmented control.
      useQuickCreateStore.getState().openCreate({ workflow: "recurring" });
      const s = useQuickCreateStore.getState();
      expect(s.workflowKind).toBe("recurring");
      expect(s.recurring.repeatMode).toBe("once");
      expect(s.identity.kind).toBe(TileKind.RECURRING);
      expect(s.time.durationMinMax).toEqual({ minMs: 30 * 60_000, maxMs: 30 * 60_000 });
      expect(s.time.span.start).not.toBe("");
      expect(s.time.whenMode).toBe("day");
    });

    it("does not overwrite slot-click time fields when called without a workflow", () => {
      // Simulate the ScheduleTimeline slot-click flow: setField before openCreate.
      useQuickCreateStore.getState().setField("time.span.start", "2026-07-30T09:00:00.000Z");
      useQuickCreateStore.getState().setField("time.span.end", "2026-07-30T10:00:00.000Z");
      useQuickCreateStore.getState().setField("time.whenMode", "day");

      useQuickCreateStore.getState().openCreate({ initialAllDay: false });

      const t = useQuickCreateStore.getState().time;
      expect(t.span.start).toBe("2026-07-30T09:00:00.000Z");
      expect(t.span.end).toBe("2026-07-30T10:00:00.000Z");
    });

    it("preserves isOpen when called while panel is closed", () => {
      useQuickCreateStore.getState().close();
      expect(useQuickCreateStore.getState().isOpen).toBe(false);
      useQuickCreateStore.getState().reset();
      expect(useQuickCreateStore.getState().isOpen).toBe(false);
    });

    it("preserves isOpen when called while panel is open", () => {
      useQuickCreateStore.getState().open();
      expect(useQuickCreateStore.getState().isOpen).toBe(true);
      useQuickCreateStore.getState().setField("identity.title", "leak");
      useQuickCreateStore.getState().reset();
      const r = useQuickCreateStore.getState();
      expect(r.isOpen).toBe(true);
      expect(r.identity.title).toBe("");
    });
  });

  describe("setWorkflow (view-only transition)", () => {
    it("preserves identity/time/recurring when switching workflows in create mode", () => {
      const store = useQuickCreateStore.getState();
      store.openCreate({ workflow: "task" });

      // User types a title and picks a time.
      useQuickCreateStore.getState().setField("identity.title", "My task");
      useQuickCreateStore.getState().setField("time.span.start", "2026-08-15T10:00:00.000Z");
      useQuickCreateStore.getState().setField("time.span.end", "2026-08-15T10:30:00.000Z");

      const before = useQuickCreateStore.getState();
      expect(before.identity.title).toBe("My task");
      expect(before.time.span.start).toBe("2026-08-15T10:00:00.000Z");
      expect(before.time.durationMinMax).toEqual({
        minMs: 30 * 60_000,
        maxMs: 30 * 60_000,
      });
      expect(before.recurring.repeatMode).toBe("once");

      // Switch workflow — the view changes; the data must not.
      useQuickCreateStore.getState().setWorkflow("event");
      let after = useQuickCreateStore.getState();
      expect(after.workflowKind).toBe("event");
      expect(after.identity.title).toBe("My task");
      expect(after.time.span.start).toBe("2026-08-15T10:00:00.000Z");
      expect(after.time.span.end).toBe("2026-08-15T10:30:00.000Z");
      // Task-default 30-min duration is preserved (no reseed to event defaults).
      expect(after.time.durationMinMax).toEqual({
        minMs: 30 * 60_000,
        maxMs: 30 * 60_000,
      });
      // recurring.repeatMode stays at its create-mode seed ("once") —
      // switching workflows must not reseed it to the recurring default.
      expect(after.recurring.repeatMode).toBe("once");

      // Switch to recurring — title and time persist again.
      useQuickCreateStore.getState().setWorkflow("recurring");
      after = useQuickCreateStore.getState();
      expect(after.workflowKind).toBe("recurring");
      expect(after.identity.title).toBe("My task");
      expect(after.time.span.start).toBe("2026-08-15T10:00:00.000Z");
      expect(after.recurring.repeatMode).toBe("once");

      // Back to task — still intact.
      useQuickCreateStore.getState().setWorkflow("task");
      after = useQuickCreateStore.getState();
      expect(after.workflowKind).toBe("task");
      expect(after.identity.title).toBe("My task");
      expect(after.time.span.start).toBe("2026-08-15T10:00:00.000Z");
    });

    it("does not reseed in edit mode (loaded tile data wins)", () => {
      const store = useQuickCreateStore.getState();
      // openEdit is the entry point that loads tile data; setWorkflow
      // must not overwrite that data, even when the user clicks the
      // workflow chip in the panel header.
      store.openEdit("placement-1", "tile-1", "event");
      useQuickCreateStore.getState().setField("identity.title", "Loaded event");
      useQuickCreateStore.getState().setField("time.span.start", "2026-09-01T09:00:00.000Z");

      useQuickCreateStore.getState().setWorkflow("task");
      const after = useQuickCreateStore.getState();
      expect(after.workflowKind).toBe("task");
      expect(after.identity.title).toBe("Loaded event");
      expect(after.time.span.start).toBe("2026-09-01T09:00:00.000Z");
    });
  });

  describe("structured tasks", () => {
    it("adds UUIDv7 tasks and updates them by id", () => {
      const id = useQuickCreateStore.getState().addTask();
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
      useQuickCreateStore.getState().setTaskField(id, "content.title", "Draft");
      useQuickCreateStore.getState().setTaskField(id, "content.note", "A note");
      const task = useQuickCreateStore.getState().plan.completion.tasks.find((t) => t.id === id);
      expect(task?.content).toEqual({ title: "Draft", note: "A note" });
    });

    it("removes dangling order rules when deleting a task", () => {
      const store = useQuickCreateStore.getState();
      const first = store.addTask("First");
      const second = store.addTask("Second");
      store.setTaskField(first, "order", [{ id: "rule", targetTaskId: second, relation: 0, when: null }]);
      store.removeTask(second);
      expect(useQuickCreateStore.getState().plan.completion.tasks.find((t) => t.id === first)?.order).toEqual([]);
    });
    it("detects cyclic rules and drops empty titles for submission", () => {
      const store = useQuickCreateStore.getState();
      const first = store.addTask("First");
      const second = store.addTask("Second");
      store.setTaskField(first, "order", [{ id: "r1", targetTaskId: second, relation: 0, when: null }]);
      store.setTaskField(second, "order", [{ id: "r2", targetTaskId: first, relation: 0, when: null }]);
      const tasks = useQuickCreateStore.getState().plan.completion.tasks;
      expect(hasTaskOrderCycle(tasks)).toBe(true);
      expect(tasksForSubmission([...tasks, { ...tasks[0], id: "empty", content: { title: " ", note: "discard" } }])).toHaveLength(tasks.length);
    });
  });

  //
  // Step 6 made GET optional by falling back to create mode on failure.
  // TODO#2 splits that further into two separate functions so the
  // edit-existing path is strict (BLOCK save on failure) and the
  // starter-template path is permissive (never GETs). See
  // `at_load_from_recurring_tile_get_failure_blocks_submit` and
  // `at_load_from_template_seeds_create_mode_without_calling_get`.

  describe("submit state (Task 8)", () => {
    it("exposes submitState as idle by default", () => {
      expect(useQuickCreateStore.getState().submitState).toEqual({ kind: "idle" });
    });

    it("exposes canSubmit and submitBlockedReason", () => {
      const s = useQuickCreateStore.getState();
      expect(s.canSubmit).toBe(false);
      expect(s.submitBlockedReason).toBeNull();
    });

    it("getFieldError returns null when no error", () => {
      expect(useQuickCreateStore.getState().getFieldError("title")).toBeNull();
    });

    it("getFieldError returns the error from fieldErrors", () => {
      useQuickCreateStore.setState({
        fieldErrors: new Map([["title", "Required"]]),
      });
      expect(useQuickCreateStore.getState().getFieldError("title")).toBe("Required");
    });

    it("resetSubmitState goes back to idle", () => {
      useQuickCreateStore.setState({
        submitState: { kind: "submitting" },
      });
      useQuickCreateStore.getState().resetSubmitState();
      expect(useQuickCreateStore.getState().submitState).toEqual({ kind: "idle" });
    });
  });

  // The Recurring form was extended with a three-pattern time model
  // (duration_only / fixed_window / window_with_duration) and a
  // Monthly-pattern tagged union. These tests cover the seed defaults
  // and the basic setField wiring for the new fields. The reset-on-flip
  // semantics live in the UI's setMonthlyKind callback, not the store,
  // because the store's setField is a plain setter.
  describe("Recurring extensions — timeModel + Monthly fields", () => {
    it("seeds time.timeModel to 'duration_only' on a fresh store", () => {
      // After `reset()` the store has the bare default — no workflow
      // seeding yet, so timeModel reflects the cross-workflow default.
      reset();
      expect(useQuickCreateStore.getState().time.timeModel).toBe("duration_only");
    });

    it("seeds time.schedulableWindow to {start:'', end:''} on a fresh store", () => {
      reset();
      expect(useQuickCreateStore.getState().time.schedulableWindow).toEqual({
        start: "",
        end: "",
      });
    });

    it("seeds recurring.monthlyKind to null and the opposing fields to sensible non-null defaults on a fresh store", () => {
      reset();
      const r = useQuickCreateStore.getState().recurring;
      expect(r.monthlyKind).toBeNull();
      // The non-active field defaults stay populated so the wire has
      // something to read if the user later flips the kind without
      // picking a new value.
      expect(r.monthlyDayOfMonth).toBe(1);
      expect(r.monthlyWeekOfMonth).toBe(1);
      expect(r.monthlyWeekday).toBe(0);
    });

    it("openCreate({ workflow: 'recurring' }) seeds window_with_duration and a 09:00–17:00 schedulable window", () => {
      useQuickCreateStore.getState().openCreate({ workflow: "recurring" });
      const t = useQuickCreateStore.getState().time;
      expect(t.timeModel).toBe("window_with_duration");
      expect(t.schedulableWindow).toEqual({ start: "09:00", end: "17:00" });
    });

    it("openCreate({ workflow: 'recurring' }) seeds monthlyKind to 'by_day' and monthlyDayOfMonth to today's day", () => {
      useQuickCreateStore.getState().openCreate({ workflow: "recurring" });
      const r = useQuickCreateStore.getState().recurring;
      expect(r.monthlyKind).toBe("by_day");
      expect(r.monthlyDayOfMonth).toBe(new Date().getDate());
    });

    it("setField('recurring.monthlyKind', 'by_day') writes the value but does not touch the by_weekday fields (UI callback owns the reset)", () => {
      // Seed a by_weekday state first.
      useQuickCreateStore.setState((s) => ({
        recurring: {
          ...s.recurring,
          monthlyKind: "by_weekday",
          monthlyWeekOfMonth: 2,
          monthlyWeekday: 3,
        },
      }));
      useQuickCreateStore.getState().setField(
        "recurring.monthlyKind",
        "by_day",
      );
      const r = useQuickCreateStore.getState().recurring;
      expect(r.monthlyKind).toBe("by_day");
      // setField is a plain setter; the cross-field reset happens in the
      // UI's setMonthlyKind callback (which calls multiple setField paths).
      expect(r.monthlyWeekOfMonth).toBe(2);
      expect(r.monthlyWeekday).toBe(3);
    });

    it("setField('time.timeModel', 'fixed_window') writes the new value", () => {
      useQuickCreateStore.getState().setField("time.timeModel", "fixed_window");
      expect(useQuickCreateStore.getState().time.timeModel).toBe("fixed_window");
    });

    it("setField('time.schedulableWindow.start', '08:30') writes the nested string", () => {
      useQuickCreateStore.getState().setField(
        "time.schedulableWindow.start",
        "08:30",
      );
      expect(useQuickCreateStore.getState().time.schedulableWindow.start).toBe(
        "08:30",
      );
    });
  });

  // The dirty-tracking gate is the final source of truth for the edit-mode
  // submit button. `selectIsDirty` returns:
  //   - `true`  when `mode === "create"` (always ready when valid)
  //   - `false` when `mode === "edit"` and `baseline === null` (loader hasn't
  //     finished hydrating yet — keeps the button disabled)
  //   - `JSON.stringify(normalizeForCompare(state)) !== baseline` otherwise
  // `captureBaseline` is called at the end of every loader's seeding step.
  describe("baseline + isDirty (edit-mode submit gate)", () => {
    it("seeds baseline === null on a fresh store", () => {
      reset();
      expect(useQuickCreateStore.getState().baseline).toBeNull();
    });

    it("selectIsDirty returns true in create mode regardless of state", () => {
      reset();
      // Empty create form is still "ready" (button enable is driven by
      // canSubmit + title; dirty is always true so the gate composes).
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
    });

    it("selectIsDirty returns false in edit mode before baseline is captured", () => {
      reset();
      useQuickCreateStore.getState().openEdit("evt-1", "tile-1", "event");
      expect(useQuickCreateStore.getState().baseline).toBeNull();
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);
    });

    it("captureBaseline snapshots the editable state", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "hello");
      useQuickCreateStore.getState().setField("meta.memo", "world");
      useQuickCreateStore.getState().captureBaseline();
      const s = useQuickCreateStore.getState();
      expect(s.baseline).not.toBeNull();
      // After capturing, the state equals the baseline → not dirty.
      expect(selectIsDirty(s)).toBe(false);
    });

    it("setField flips isDirty to true after baseline", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "hello");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().setField("identity.title", "hello-edited");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
    });

    it("restoring the original value flips isDirty back to false", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "hello");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().setField("identity.title", "X");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
      useQuickCreateStore.getState().setField("identity.title", "hello");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);
    });

    it("addTask / removeTask / setTaskField / reorderTasks / duplicateTask / toggleTaskDone flip isDirty", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "t");
      useQuickCreateStore.getState().captureBaseline();

      // baseline.tasks === []. addTask adds one row → dirty. Removing
      // it returns to the empty baseline → clean.
      const t1 = useQuickCreateStore.getState().addTask("T1");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
      useQuickCreateStore.getState().setTaskField(t1, "content.title", "T1b");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
      useQuickCreateStore.getState().removeTask(t1);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);

      // Seed two tasks, capture baseline, reorder, reverse reorder.
      const tA = useQuickCreateStore.getState().addTask("A");
      const tB = useQuickCreateStore.getState().addTask("B");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().reorderTasks(0, 1);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
      useQuickCreateStore.getState().reorderTasks(1, 0);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);

      // duplicateTask creates a new row → dirty.
      useQuickCreateStore.getState().duplicateTask(tA);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
      // toggleTaskDone flips the author-side done flag → dirty.
      useQuickCreateStore.getState().captureBaseline();
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);
      useQuickCreateStore.getState().toggleTaskDone(tB);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
    });

    it("setLabelOnly flips isDirty", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "t");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().setLabelOnly(true);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
    });

    it("setWorkflow / setActivePanel / setLegacyEditor do NOT flip isDirty", () => {
      reset();
      useQuickCreateStore.setState({ mode: "edit" });
      useQuickCreateStore.getState().setField("identity.title", "t");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().setWorkflow("event");
      useQuickCreateStore.getState().setActivePanel("time");
      useQuickCreateStore.getState().setLegacyEditor(true);
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);
    });

    it("reset clears baseline", () => {
      reset();
      useQuickCreateStore.getState().setField("identity.title", "t");
      useQuickCreateStore.getState().captureBaseline();
      expect(useQuickCreateStore.getState().baseline).not.toBeNull();
      useQuickCreateStore.getState().reset();
      expect(useQuickCreateStore.getState().baseline).toBeNull();
    });

    it("close clears baseline", () => {
      reset();
      useQuickCreateStore.getState().setField("identity.title", "t");
      useQuickCreateStore.getState().captureBaseline();
      useQuickCreateStore.getState().close();
      expect(useQuickCreateStore.getState().baseline).toBeNull();
    });

    it("loadFromEvent captures baseline so subsequent setField flips isDirty", () => {
      reset();
      const event = {
        id: "evt-1",
        title: "Standup",
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T09:30:00.000Z",
        allDay: false,
        color: "#3b82f6",
        memo: "",
      };
      // Cast to the minimal shape the store accepts.
      useQuickCreateStore.getState().loadFromEvent(event as never);
      expect(useQuickCreateStore.getState().mode).toBe("edit");
      expect(useQuickCreateStore.getState().baseline).not.toBeNull();
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(false);
      useQuickCreateStore.getState().setField("identity.title", "Standup (edit)");
      expect(selectIsDirty(useQuickCreateStore.getState())).toBe(true);
    });

    it("loadFromEvent maps allDay=true to time.timeOfDayMode === 'all-day'", () => {
      reset();
      useQuickCreateStore.getState().loadFromEvent({
        id: "evt-1",
        title: "Holiday",
        start: "2026-09-01T00:00:00.000Z",
        end: "2026-09-02T00:00:00.000Z",
        allDay: true,
        color: "#3b82f6",
        memo: "",
      } as never);
      const t = useQuickCreateStore.getState().time;
      expect(t.timeOfDayMode).toBe("all-day");
      expect(t.timeOfDayStart).toBe("00:00");
      expect(t.timeOfDayEnd).toBe("23:59");
    });

    it("loadFromPlacementEvent captures baseline synchronously even when async enrichment fails", async () => {
      reset();
      // Mock the dynamic import to throw on every call.
      vi.resetModules();
      vi.doMock("@/shared/api/endpoints", () => ({
        getCoreClient: () => ({
          call: () => Promise.reject(new Error("network down")),
        }),
      }));
      // Re-import the store so the mocked module is bound to its dynamic import.
      const { useQuickCreateStore: reimported } = await import(
        "./quick-create-store"
      );
      reimported.getState().reset();
      await reimported.getState().loadFromPlacementEvent({
        id: "evt-1",
        title: "Standup",
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T09:30:00.000Z",
        allDay: false,
        color: "#3b82f6",
        tileId: "tile-1",
        memo: "",
      } as never);
      // After the failed enrichment, baseline is captured (from event
      // data), loadError is set, submitBlocked stays false (the loader
      // does not block submit on partial enrichment).
      const s = reimported.getState();
      expect(s.baseline).not.toBeNull();
      expect(s.loadError).toMatch(/Could not load full tile data/);
      expect(s.submitBlocked).toBe(false);
      vi.doUnmock("@/shared/api/endpoints");
      vi.resetModules();
    });

    it("loadFromTemplate captures baseline (mode=create so isDirty stays true regardless)", () => {
      reset();
      useQuickCreateStore.getState().loadFromTemplate({
        id: "tpl-1",
        title: "Daily standup",
        note: "Routine",
        recurrence: undefined,
      });
      const s = useQuickCreateStore.getState();
      expect(s.mode).toBe("create");
      expect(s.baseline).not.toBeNull();
      expect(selectIsDirty(s)).toBe(true);
    });

    it("selectIsDirty uses a deterministic key order regardless of object construction", () => {
      // The same editable state built two different ways must produce the
      // same baseline string — that is what makes the dirty gate
      // reproducible.
      reset();
      useQuickCreateStore.getState().setField("identity.title", "X");
      useQuickCreateStore.getState().captureBaseline();
      const a = useQuickCreateStore.getState().baseline;
      // Reset and rebuild with explicit key order on the next snapshot.
      useQuickCreateStore.getState().reset();
      useQuickCreateStore.getState().setField("identity.title", "X");
      useQuickCreateStore.getState().captureBaseline();
      const b = useQuickCreateStore.getState().baseline;
      expect(a).toBe(b);
    });
  });
});
