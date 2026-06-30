import { describe, expect, it, beforeEach } from "vitest";
import { useQuickCreateStore } from "./quick-create-store";
import { PlanRole, RecurringState } from "@/lib/domain/v1/constants";

const reset = () => useQuickCreateStore.getState().reset();

describe("useQuickCreateStore", () => {
  beforeEach(() => reset());

  describe("initial state", () => {
    it("starts with default identity, plan, time, windows, recurring, advanced, meta", () => {
      const s = useQuickCreateStore.getState();
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
      // defaultTime now seeds the next upcoming half-hour, so we
      // assert on shape rather than specific timestamps.
      expect(typeof s.time.span.start).toBe("string");
      expect(s.time.span.start).not.toBe("");
      expect(typeof s.time.span.end).toBe("string");
      expect(s.time.span.end).not.toBe("");
      expect(new Date(s.time.span.end).getTime()).toBeGreaterThan(
        new Date(s.time.span.start).getTime(),
      );
      expect(s.time.durationMinMax).toEqual({ minMs: 1800000, maxMs: 5400000 });
      expect(s.windows).toEqual([]);
      expect(s.recurring.life.active).toEqual({ startDate: "", endDate: "" });
      expect(s.recurring.life.state).toBe(RecurringState.ACTIVE);
      expect(s.recurring.frameRules).toEqual([]);
      expect(s.recurring.rules).toEqual([]);
      expect(s.advanced.changeSets).toEqual([]);
      expect(s.advanced.rules).toEqual([]);
      expect(s.meta.ownerSubjectId).toBeNull();
      expect(s.meta.tags).toEqual([]);
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

    it("sets meta.memo", () => {
      useQuickCreateStore.getState().setField("meta.memo", "remember this");
      expect(useQuickCreateStore.getState().meta.memo).toBe("remember this");
    });

    it("sets meta.tags array", () => {
      useQuickCreateStore.getState().setField("meta.tags", ["a", "b"]);
      expect(useQuickCreateStore.getState().meta.tags).toEqual(["a", "b"]);
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
});
