/**
 * Tests for buildCreateTile / substituteTileId (Task 4).
 *
 * Test fixtures use the snapshot shape documented in the v1 tile-creation UI
 * plan (see `docs/superpowers/plans/2026-06-26-tile-creation-ui-v1.md`,
 * Phase B / Task 4). The snapshot is a *narrow input* to the builder — it
 * does NOT need to match every field of the live `QuickCreateState` store.
 * The store keeps editor and open/close state; the builder only consumes
 * the command-relevant fields.
 */

import { describe, expect, it } from "vitest";
import {
  buildCreateTile,
  substituteTileId,
} from "./build-command";
import { TileKind, PlanRole } from "@/tile/model/v1/constants";

function recurringSnapshot() {
  return {
    identity: {
      title: "Weekly English",
      kind: TileKind.RECURRING,
      externalId: { value: null },
      visual: { color: "#5E6AD2", icon: "sun" },
    },
    plan: {
      role: PlanRole.EXECUTABLE,
      references: [],
      completion: { root: { kind: 0, children: [] }, timeRequirements: [], tasks: [] },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
    },
    time: {
      span: { start: "2026-06-26T00:00:00Z", end: null, offsetMin: 540 },
      durationMinMax: { min: 25, max: 60 },
    },
    windows: [],
    recurring: {
      life: { state: 0, activeStart: "2026-06-26", activeEnd: null },
      frameRules: [{ id: "f1", kind: 2, anchor: "weekly", weekdayMask: 0b0000001 }],
      recurringRules: [],
    },
    advanced: { changeSets: [], rules: [] },
    meta: { project: null, tags: ["english"], memo: "", isLabelOnly: false },
  };
}

function placementSnapshot() {
  return {
    identity: {
      title: "Math today",
      kind: TileKind.PLACEMENT,
      externalId: { value: null },
      visual: { color: "#5E6AD2", icon: "sun" },
    },
    plan: {
      role: PlanRole.EXECUTABLE,
      references: [],
      completion: { root: { kind: 0, children: [] }, timeRequirements: [], tasks: [] },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
    },
    time: {
      span: { start: "2026-06-26T19:00:00Z", end: "2026-06-26T21:00:00Z", offsetMin: 540 },
      durationMinMax: { min: 60, max: 120 },
    },
    windows: [],
    recurring: {
      life: { state: 0, activeStart: null, activeEnd: null },
      frameRules: [],
      recurringRules: [],
    },
    advanced: { changeSets: [], rules: [] },
    meta: { project: null, tags: [], memo: "", isLabelOnly: false },
  };
}

function labelSnapshot() {
  return {
    identity: {
      title: "During term",
      kind: TileKind.PLACEMENT,
      externalId: { value: null },
      visual: { color: "#999", icon: "tag" },
    },
    plan: {
      role: PlanRole.LABEL,
      references: [],
      completion: { root: { kind: 0, children: [] }, timeRequirements: [], tasks: [] },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
    },
    time: {
      span: { start: "2026-06-26T00:00:00Z", end: "2026-09-30T00:00:00Z", offsetMin: 540 },
      durationMinMax: { min: null, max: null },
    },
    windows: [],
    recurring: {
      life: { state: 0, activeStart: null, activeEnd: null },
      frameRules: [],
      recurringRules: [],
    },
    advanced: { changeSets: [], rules: [] },
    meta: { project: null, tags: [], memo: "", isLabelOnly: true },
  };
}

describe("buildCreateTile — RECURRING", () => {
  it("returns 4 envelopes: createTile, setPlan, appendFrames, appendRules", () => {
    const envelopes = buildCreateTile(
      recurringSnapshot(),
      "key-uuidv7",
    );

    expect(envelopes).toHaveLength(4);
    const [create, plan, frames] = envelopes;
    expect(create.path).toBe("/v1/tiles");
    expect((create.payload as { kind: number }).kind).toBe(0);
    expect(create.idempotencyKey).toBe("key-uuidv7");
    expect(plan.path).toBe("/v1/tiles/{tileId}/plan");
    expect((plan.payload as { role: number }).role).toBe(0);
    expect(frames.path).toBe("/v1/recurrings/{tileId}/frames");
    expect(frames.payload).toHaveLength(1);
    expect(envelopes[3].path).toBe("/v1/recurrings/{tileId}/rules");
  });
});

describe("buildCreateTile — PLACEMENT", () => {
  it("returns 2 envelopes (no frames/rules)", () => {
    const envelopes = buildCreateTile(placementSnapshot(), "k1") as Array<{
      path: string;
    }>;

    expect(envelopes).toHaveLength(2);
    expect(envelopes[1].path).toBe("/v1/tiles/{tileId}/plan");
  });
});

describe("buildCreateTile — LABEL", () => {
  it("PLACEMENT + role=1 + isLabelOnly=true", () => {
    const envelopes = buildCreateTile(labelSnapshot(), "k1") as Array<{
      payload: { role: number; completion: unknown };
    }>;

    expect(envelopes).toHaveLength(2);
    expect(envelopes[1].payload.role).toBe(1);
    expect(envelopes[1].payload.completion).toEqual({
      root: { kind: 0, children: [] },
      timeRequirements: [],
      tasks: [],
    });
  });
});

describe("buildCreateTile — idempotencyKey propagation", () => {
  it("all envelopes share the same key", () => {
    const envelopes = buildCreateTile(
      recurringSnapshot(),
      "shared-key",
    );
    envelopes.forEach((e) => expect(e.idempotencyKey).toBe("shared-key"));
  });
});

describe("substituteTileId", () => {
  it("replaces {tileId} placeholder in every path", () => {
    const envelopes = buildCreateTile(recurringSnapshot(), "k");
    const replaced = substituteTileId(envelopes, "tile-123");
    expect(replaced[0].path).toBe("/v1/tiles");
    expect(replaced[1].path).toBe("/v1/tiles/tile-123/plan");
    expect(replaced[2].path).toBe("/v1/recurrings/tile-123/frames");
    expect(replaced[3].path).toBe("/v1/recurrings/tile-123/rules");
  });

  it("does not mutate the original envelopes", () => {
    const envelopes = buildCreateTile(recurringSnapshot(), "k");
    substituteTileId(envelopes, "tile-123");
    expect(envelopes[1].path).toBe("/v1/tiles/{tileId}/plan");
  });
});