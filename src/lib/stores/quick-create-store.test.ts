import { describe, expect, it, beforeEach, vi } from "vitest";
import { useQuickCreateStore } from "./quick-create-store";
import { PlanRole, RecurringState, TileKind } from "@/lib/domain/v1/constants";

// `vi.hoisted` runs before module imports so the captured reference is
// available inside the hoisted `vi.mock` factory below. Each test then
// calls `mockGetCoreClient.mockReturnValue(...)` to drive the response
// shape returned by `getCoreClient().call("getTile", ...)` invoked from
// inside `loadFromRecurringTile`.
const { mockGetCoreClient, mockCoreCall } = vi.hoisted(() => ({
  mockGetCoreClient: vi.fn(),
  mockCoreCall: vi.fn(),
}));

vi.mock("@/lib/api/endpoints", () => ({
  getCoreClient: () => mockGetCoreClient(),
}));

// Internal handle: every `getCoreClient().call(...)` walks through this
// vi.fn. Tests set its `.mockResolvedValueOnce` / `.mockResolvedValue` to
// drive the response shape without hitting proxy / v1 daemon.
mockGetCoreClient.mockImplementation(() => ({ call: mockCoreCall }));

const reset = () => useQuickCreateStore.getState().reset();

describe("useQuickCreateStore", () => {
  beforeEach(() => {
    reset();
    mockGetCoreClient.mockClear();
    mockCoreCall.mockReset();
  });

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

  // Plan ref: docs/plans/2026-07-04-tile-panel-create-flow.md §B refinement
  //
  // Step 6 made GET optional by falling back to create mode on failure.
  // TODO#2 splits that further into two separate functions so the
  // edit-existing path is strict (BLOCK save on failure) and the
  // starter-template path is permissive (never GETs). See
  // `at_load_from_recurring_tile_get_failure_blocks_submit` and
  // `at_load_from_template_seeds_create_mode_without_calling_get`.

  describe("loadFromRecurringTile (TODO#2 refinement: BLOCK save on failure)", () => {
    it("at_load_from_recurring_tile_get_failure_blocks_submit", async () => {
      // Edit-existing path: caller has a real tileId from a placement or
      // event. Plan §B refinement: GET failure must NOT fall back to
      // create mode (that would let Submit UPDATE_TILE a phantom id).
      // Instead, keep the panel in edit mode, keep editingId set so
      // the panel remembers what the user intended, and set
      // submitBlocked=true so QuickTileCreate disables Submit until the
      // tile is re-fetchable. Caller will retry or close.
      mockCoreCall.mockResolvedValueOnce({
        ok: false,
        error: { kind: "network", message: "ECONNREFUSED" },
      });

      const result = await useQuickCreateStore
        .getState()
        .loadFromRecurringTile("0192b123-4567-7890-abcd-ef0123456789");

      const s = useQuickCreateStore.getState();
      expect(result).toBeNull();
      expect(s.isOpen).toBe(true);
      // Edit mode + editingId preserved so the user sees what they
      // intended to edit; submitBlocked prevents accidental UPDATE_TILE.
      expect(s.mode).toBe("edit");
      expect(s.editingId).toBe("0192b123-4567-7890-abcd-ef0123456789");
      expect(s.editingTileId).toBe("0192b123-4567-7890-abcd-ef0123456789");
      expect(s.submitBlocked).toBe(true);
      expect(s.loadError).toContain("0192b123-4567-7890-abcd-ef0123456789");
    });

    it("clears submitBlocked on successful hydration", async () => {
      mockCoreCall.mockResolvedValueOnce({
        ok: true,
        data: {
          id: "0192b123-4567-7890-abcd-ef0123456789",
          kind: 0,
          title: "Existing recurring tile",
          description: null,
          color: "#5e6ad2",
          icon: "Repeat",
          external_id: null,
          plan_id: null,
        },
      });

      await useQuickCreateStore
        .getState()
        .loadFromRecurringTile("0192b123-4567-7890-abcd-ef0123456789");

      const s = useQuickCreateStore.getState();
      expect(s.isOpen).toBe(true);
      expect(s.mode).toBe("edit");
      expect(s.editingId).toBe("0192b123-4567-7890-abcd-ef0123456789");
      expect(s.editingTileId).toBe("0192b123-4567-7890-abcd-ef0123456789");
      expect(s.submitBlocked).toBe(false);
      expect(s.identity.title).toBe("Existing recurring tile");
      expect(s.loadError).toBeNull();
    });
  });

  describe("loadFromTemplate (TODO#2: starter templates, no GET)", () => {
    it("at_load_from_template_seeds_create_mode_without_calling_get", () => {
      // Defensive regression: loadFromTemplate must accept arbitrary
      // string ids and a non-default recurrence shape without calling
      // /v1/tiles/{id} and without crashing on v0-vintage fixtures.
      // (The proxy's `defaultBreakRecurringTemplate` shim was removed
      // 2026-07-07; the literal id is retained here only as a
      // recognised non-UUIDv7 sentinel.)
      const template = {
        id: "default-break-recurring",
        title: "休憩",
        note: "Default break template",
        recurrence: {
          generator: { kind: "time_based", step_min: 1440, anchor_epoch_min: null },
          window: {
            weekday_mask: 0b1111111,
            start_offset_min: 0,
            end_offset_min: 1440,
            exclusions: [],
          },
          selector: { expression: null },
        },
      };

      useQuickCreateStore.getState().loadFromTemplate(template);

      const s = useQuickCreateStore.getState();
      expect(mockCoreCall).not.toHaveBeenCalled();
      expect(s.isOpen).toBe(true);
      expect(s.mode).toBe("create");
      expect(s.editingId).toBeNull();
      expect(s.editingTileId).toBeNull();
      expect(s.submitBlocked).toBe(false);
      expect(s.identity.title).toBe("休憩");
      expect(s.identity.kind).toBe(TileKind.RECURRING);
      expect(s.recurrence).toEqual(template.recurrence);
    });
  });
});
