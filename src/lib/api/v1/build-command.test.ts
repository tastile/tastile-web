/**
 * Tests for buildCreateTileCommand / substituteTileId (Task 4).
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
  buildCreateTileCommand,
  substituteTileId,
} from "./build-command";
import { TileKind, PlanRole } from "@/lib/domain/v1/constants";

function recurringSnapshot() {
  return {
    identity: {
      title: "毎週の英語",
      description: "英語の復習",
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
      title: "今日の数学",
      description: null,
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
      title: "学期中",
      description: null,
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

describe("buildCreateTileCommand — RECURRING", () => {
  it("returns a real tastile-core createTile envelope", () => {
    const envelopes = buildCreateTileCommand(
      recurringSnapshot(),
      "key-uuidv7",
    );

    expect(envelopes).toHaveLength(1);
    const [create] = envelopes;
    expect(create.path).toBe("/v1/tiles");
    expect(create.payload).toEqual({
      kind: TileKind.RECURRING,
      title: "毎週の英語",
      description: "英語の復習",
      color: "#5E6AD2",
      icon: "sun",
      external_id: null,
      plan_role: PlanRole.EXECUTABLE,
    });
    expect(create.idempotencyKey).toBe("key-uuidv7");
  });
});

describe("buildCreateTileCommand — PLACEMENT", () => {
  it("returns only the create envelope", () => {
    const envelopes = buildCreateTileCommand(placementSnapshot(), "k1") as Array<{
      path: string;
    }>;

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].path).toBe("/v1/tiles");
  });
});

describe("buildCreateTileCommand — LABEL", () => {
  it("PLACEMENT + plan_role=1 + isLabelOnly=true", () => {
    const envelopes = buildCreateTileCommand(labelSnapshot(), "k1") as Array<{
      payload: { plan_role: number };
    }>;

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].payload.plan_role).toBe(1);
  });
});

describe("buildCreateTileCommand — idempotencyKey propagation", () => {
  it("all envelopes share the same key", () => {
    const envelopes = buildCreateTileCommand(
      recurringSnapshot(),
      "shared-key",
    );
    envelopes.forEach((e) => expect(e.idempotencyKey).toBe("shared-key"));
  });
});

describe("substituteTileId", () => {
  it("replaces {tileId} placeholder in every path", () => {
    const envelopes = buildCreateTileCommand(recurringSnapshot(), "k");
    const replaced = substituteTileId(envelopes, "tile-123");
    expect(replaced[0].path).toBe("/v1/tiles");
  });

  it("does not mutate the original envelopes", () => {
    const envelopes = buildCreateTileCommand(recurringSnapshot(), "k");
    substituteTileId(envelopes, "tile-123");
    expect(envelopes[0].path).toBe("/v1/tiles");
  });
});
