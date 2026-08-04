import { describe, expect, it } from "vitest";

import type { ConditionNode } from "@/tile/model/v1/condition";
import {
  CandidateEffectKind,
  DecisionObserveScope,
  type DecisionCandidate,
  type DecisionDef,
  evaluateCandidates,
  serializeDecision,
} from "./decision";

const ALWAYS_TRUE: ConditionNode = { kind: 0, children: [], term: null };

function makeDef(candidates: DecisionCandidate[]): DecisionDef {
  return {
    id: "01900000-0000-7000-8000-000000000001",
    observe: { scope: DecisionObserveScope.PLACEMENT },
    candidates,
    reuse: [],
    dialog: null,
  };
}

describe("DecisionDef type constants", () => {
  it("DecisionObserveScope values match v1/06", () => {
    expect(DecisionObserveScope.PLAN).toBe(0);
    expect(DecisionObserveScope.FRAME).toBe(1);
    expect(DecisionObserveScope.PLACEMENT).toBe(2);
    expect(DecisionObserveScope.EXECUTION).toBe(3);
  });

  it("CandidateEffectKind values match v1/06", () => {
    expect(CandidateEffectKind.PROPOSE_PLACEMENT).toBe(0);
    expect(CandidateEffectKind.PROPOSE_CHANGE).toBe(1);
    expect(CandidateEffectKind.REQUEST).toBe(2);
  });
});

describe("serializeDecision", () => {
  it("converts store-shape DecisionDef to wire shape", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: DecisionObserveScope.PLACEMENT },
      candidates: [
        {
          id: "01900000-0000-7000-8000-000000000002",
          when: ALWAYS_TRUE,
          rank: 0,
          effects: [
            {
              kind: CandidateEffectKind.PROPOSE_PLACEMENT,
              proposal: { span: { start: "2026-07-01T00:00:00Z", end: "2026-07-01T01:00:00Z" } },
              change: null,
              request: null,
            },
          ],
        },
      ],
      reuse: [],
      dialog: null,
    };

    const wire = serializeDecision(def) as Record<string, unknown>;

    expect(wire.id).toBe(def.id);
    expect(wire.observe).toEqual({ scope: 2 });

    const candidates = wire.candidates as Array<Record<string, unknown>>;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].when).toEqual({ All: [] });
    expect(candidates[0].rank).toBe(0);

    const effects = candidates[0].effects as Array<Record<string, unknown>>;
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe(0);
    expect(effects[0].proposal).toEqual({
      span: { start: "2026-07-01T00:00:00Z", end: "2026-07-01T01:00:00Z" },
    });
  });

  it("converts nested ConditionNode in candidate.when", () => {
    const def = makeDef([
      {
        id: "c1",
        when: {
          kind: 3,
          children: [],
          term: { kind: "task", value: { taskId: "t1", state: 2 } },
        },
        rank: 0,
        effects: [],
      },
    ]);

    const wire = serializeDecision(def) as Record<string, unknown>;
    const candidates = wire.candidates as Array<Record<string, unknown>>;
    expect(candidates[0].when).toEqual({
      Term: { Task: { task_id: "t1", state: "Completed" } },
    });
  });

  it("preserves reuse and dialog fields", () => {
    const def = makeDef([]);
    def.reuse = [{ id: "r1", when: ALWAYS_TRUE, source: {}, apply: [] }];
    def.dialog = { node: "root" };

    const wire = serializeDecision(def) as Record<string, unknown>;
    expect(wire.reuse).toEqual([{ id: "r1", when: ALWAYS_TRUE, source: {}, apply: [] }]);
    expect(wire.dialog).toEqual({ node: "root" });
  });
});

describe("evaluateCandidates", () => {
  const ctx = { now: new Date(), activePlacementIds: [] };

  it("returns SessionPending with empty array when no candidates", () => {
    const def = makeDef([]);
    const result = evaluateCandidates(def, ctx);
    expect(result).toEqual({ kind: "SessionPending", selectedCandidateIds: [] });
  });

  it("returns AutoResolved when exactly one candidate", () => {
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [] },
    ]);
    const result = evaluateCandidates(def, ctx);
    expect(result).toEqual({ kind: "AutoResolved", selectedCandidateIds: ["c1"] });
  });

  it("returns SessionPending with sorted ids when multiple candidates", () => {
    const def = makeDef([
      { id: "c2", when: ALWAYS_TRUE, rank: 5, effects: [] },
      { id: "c1", when: ALWAYS_TRUE, rank: 1, effects: [] },
      { id: "c3", when: ALWAYS_TRUE, rank: 10, effects: [] },
    ]);
    const result = evaluateCandidates(def, ctx);
    expect(result).toEqual({
      kind: "SessionPending",
      selectedCandidateIds: ["c1", "c2", "c3"],
    });
  });

  it("filters out candidates with null when condition", () => {
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [] },
      { id: "c2", when: null as unknown as ConditionNode, rank: 1, effects: [] },
    ]);
    const result = evaluateCandidates(def, ctx);
    expect(result).toEqual({ kind: "AutoResolved", selectedCandidateIds: ["c1"] });
  });

  it("returns SessionPending when all candidates have null when", () => {
    const def = makeDef([
      { id: "c1", when: null as unknown as ConditionNode, rank: 0, effects: [] },
    ]);
    const result = evaluateCandidates(def, ctx);
    expect(result).toEqual({ kind: "SessionPending", selectedCandidateIds: [] });
  });
});

describe("DecisionDef satisfies interface contract", () => {
  it("REQUEST kind CandidateEffect can carry idempotencyKey", () => {
    const effect = {
      kind: CandidateEffectKind.REQUEST,
      proposal: null,
      change: null,
      request: { idempotencyKey: "01900000-0000-7000-8000-000000000abc" },
    };
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [effect] },
    ]);
    const wire = serializeDecision(def) as Record<string, unknown>;
    const candidates = wire.candidates as Array<Record<string, unknown>>;
    const effects = candidates[0].effects as Array<Record<string, unknown>>;
    expect(effects[0].request).toEqual({ idempotencyKey: "01900000-0000-7000-8000-000000000abc" });
  });
});
