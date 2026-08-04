import { describe, expect, it, beforeEach, vi } from "vitest";
import { hasTaskOrderCycle, tasksForSubmission, useQuickCreateStore } from "./quick-create-store";
import { PlanRole, RecurringState, TileKind } from "@/tile/model/v1/constants";

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
      expect(s.time.durationMinMax).toEqual({ minMs: 1800000, maxMs: 5400000 });
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
});
