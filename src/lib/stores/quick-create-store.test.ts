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
      expect(s.identity.visual.color).toBe("");
      expect(s.identity.visual.icon).toBe("");
      expect(s.plan.role).toBe(PlanRole.EXECUTABLE);
      expect(s.plan.references).toEqual([]);
      expect(s.plan.completion).toBeDefined();
      expect(s.plan.planning.placementRules).toEqual([]);
      expect(s.plan.metrics).toEqual([]);
      expect(s.plan.decisions).toEqual([]);
      expect(s.time.span).toEqual({ start: "", end: "" });
      expect(s.time.durationMinMax).toEqual({ minMs: null, maxMs: null });
      expect(s.windows).toEqual([]);
      expect(s.recurring.life.active).toEqual({ startDate: "", endDate: "" });
      expect(s.recurring.life.state).toBe(RecurringState.ACTIVE);
      expect(s.recurring.frames).toEqual([]);
      expect(s.recurring.rules).toEqual([]);
      expect(s.advanced.changeSets).toEqual([]);
      expect(s.advanced.rules).toEqual([]);
      expect(s.meta.project).toBeNull();
      expect(s.meta.tags).toEqual([]);
      expect(s.meta.memo).toBe("");
      expect(s.meta.isLabelOnly).toBe(false);
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

  describe("setKind", () => {
    it("defaults to RECURRING (0)", () => {
      expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.EXECUTABLE);
    });

    it("switches plan.role and identity kind together", () => {
      useQuickCreateStore.getState().setKind(1);
      expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.EXECUTABLE);
      useQuickCreateStore.getState().setLabelOnly(true);
      expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.LABEL);
    });
  });

  describe("setLabelOnly", () => {
    it("flips role to LABEL (1)", () => {
      useQuickCreateStore.getState().setLabelOnly(true);
      expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.LABEL);
    });

    it("flips role back to EXECUTABLE (0)", () => {
      useQuickCreateStore.getState().setLabelOnly(true);
      useQuickCreateStore.getState().setLabelOnly(false);
      expect(useQuickCreateStore.getState().plan.role).toBe(PlanRole.EXECUTABLE);
    });

    it("sets meta.isLabelOnly mirror", () => {
      useQuickCreateStore.getState().setLabelOnly(true);
      expect(useQuickCreateStore.getState().meta.isLabelOnly).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears all state back to defaults", () => {
      const s = useQuickCreateStore.getState();
      s.setField("identity.title", "leak");
      s.setField("meta.memo", "leak");
      s.setLabelOnly(true);
      s.reset();
      const r = useQuickCreateStore.getState();
      expect(r.identity.title).toBe("");
      expect(r.meta.memo).toBe("");
      expect(r.meta.isLabelOnly).toBe(false);
      expect(r.plan.role).toBe(PlanRole.EXECUTABLE);
    });
  });
});