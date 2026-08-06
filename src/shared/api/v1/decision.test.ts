import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

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

  it("PROPOSE_PLACEMENT kind carries proposal with span", () => {
    const effect = {
      kind: CandidateEffectKind.PROPOSE_PLACEMENT,
      proposal: { span: { start: "2026-07-01T00:00:00Z", end: "2026-07-01T01:00:00Z" } },
      change: null,
      request: null,
    };
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [effect] },
    ]);
    const wire = serializeDecision(def) as Record<string, unknown>;
    const candidates = wire.candidates as Array<Record<string, unknown>>;
    const effects = candidates[0].effects as Array<Record<string, unknown>>;
    expect(effects[0].proposal).toEqual({
      span: { start: "2026-07-01T00:00:00Z", end: "2026-07-01T01:00:00Z" },
    });
  });

  it("DecisionDef has all 5 required fields", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: DecisionObserveScope.PLAN },
      candidates: [],
      reuse: [],
      dialog: null,
    };
    expect(def).toHaveProperty("id");
    expect(def).toHaveProperty("observe");
    expect(def).toHaveProperty("candidates");
    expect(def).toHaveProperty("reuse");
    expect(def).toHaveProperty("dialog");
  });

  it("DecisionCandidate has all 4 required fields", () => {
    const candidate: DecisionCandidate = {
      id: "01900000-0000-7000-8000-000000000002",
      when: ALWAYS_TRUE,
      rank: 0,
      effects: [],
    };
    expect(candidate).toHaveProperty("id");
    expect(candidate).toHaveProperty("when");
    expect(candidate).toHaveProperty("rank");
    expect(candidate).toHaveProperty("effects");
  });

  it("evaluateCandidates returns AutoResolved for single candidate", () => {
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [] },
    ]);
    const result = evaluateCandidates(def, { now: new Date(), activePlacementIds: [] });
    expect(result.kind).toBe("AutoResolved");
    expect(result.selectedCandidateIds).toEqual(["c1"]);
  });

  it("evaluateCandidates returns SessionPending for zero candidates", () => {
    const def = makeDef([]);
    const result = evaluateCandidates(def, { now: new Date(), activePlacementIds: [] });
    expect(result.kind).toBe("SessionPending");
    expect(result.selectedCandidateIds).toEqual([]);
  });

  it("evaluateCandidates returns SessionPending for multiple candidates", () => {
    const def = makeDef([
      { id: "c1", when: ALWAYS_TRUE, rank: 0, effects: [] },
      { id: "c2", when: ALWAYS_TRUE, rank: 1, effects: [] },
    ]);
    const result = evaluateCandidates(def, { now: new Date(), activePlacementIds: [] });
    expect(result.kind).toBe("SessionPending");
    expect(result.selectedCandidateIds).toHaveLength(2);
  });

  it("evaluateCandidates sorts candidates by rank", () => {
    const def = makeDef([
      { id: "c2", when: ALWAYS_TRUE, rank: 5, effects: [] },
      { id: "c1", when: ALWAYS_TRUE, rank: 1, effects: [] },
      { id: "c3", when: ALWAYS_TRUE, rank: 10, effects: [] },
    ]);
    const result = evaluateCandidates(def, { now: new Date(), activePlacementIds: [] });
    expect(result.selectedCandidateIds).toEqual(["c1", "c2", "c3"]);
  });
});

// ---------- Property tests (fast-check) ----------

const hexChar = fc.constantFrom(..."0123456789abcdef".split(""));
const hexStr = (n: number) =>
  fc.array(hexChar, { minLength: n, maxLength: n }).map((a) => a.join(""));

const uuidv7Arb = hexStr(32).map(
  (h) =>
    `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`,
);

const conditionNodeArb: fc.Arbitrary<ConditionNode> = fc.constant(ALWAYS_TRUE);

function decisionDefArb(): fc.Arbitrary<DecisionDef> {
  return fc.record({
    id: uuidv7Arb,
    observe: fc.record({
      scope: fc.constantFrom(
        DecisionObserveScope.PLAN,
        DecisionObserveScope.FRAME,
        DecisionObserveScope.PLACEMENT,
        DecisionObserveScope.EXECUTION,
      ),
    }),
    candidates: fc.array(
      fc.record({
        id: uuidv7Arb,
        when: conditionNodeArb,
        rank: fc.integer({ min: -100, max: 100 }),
        effects: fc.array(
          fc.record({
            kind: fc.constantFrom(
              CandidateEffectKind.PROPOSE_PLACEMENT,
              CandidateEffectKind.PROPOSE_CHANGE,
              CandidateEffectKind.REQUEST,
            ),
            proposal: fc.constant(null),
            change: fc.constant(null),
            request: fc.constant(null),
          }),
          { maxLength: 3 },
        ),
      }),
      { maxLength: 5 },
    ),
    reuse: fc.array(
      fc.record({
        id: uuidv7Arb,
        when: conditionNodeArb,
        source: fc.constant(null),
        apply: fc.constant([]),
      }),
      { maxLength: 3 },
    ),
    dialog: fc.constant(null),
  });
}

describe("DecisionDef ser/de round-trip", () => {
  it("serializeDecision produces valid JSON (50 random decisions)", () => {
    fc.assert(
      fc.property(decisionDefArb(), (def) => {
        const serialized = serializeDecision(def);
        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(serialized);
      }),
      { numRuns: 50 },
    );
  });

  it("covers all DecisionObserveScope values", () => {
    for (const scope of [0, 1, 2, 3]) {
      const def: DecisionDef = {
        id: "01900000-0000-7000-8000-000000000001",
        observe: { scope },
        candidates: [],
        reuse: [],
        dialog: null,
      };
      const serialized = serializeDecision(def) as Record<string, unknown>;
      expect((serialized.observe as Record<string, unknown>).scope).toBe(scope);
    }
  });

  it("covers all CandidateEffectKind values", () => {
    for (const kind of [0, 1, 2]) {
      const def: DecisionDef = {
        id: "01900000-0000-7000-8000-000000000001",
        observe: { scope: 0 },
        candidates: [
          {
            id: "01900000-0000-7000-8000-000000000002",
            when: { kind: 0, children: [], term: null },
            rank: 0,
            effects: [{ kind, proposal: null, change: null, request: null }],
          },
        ],
        reuse: [],
        dialog: null,
      };
      const serialized = serializeDecision(def) as Record<string, unknown>;
      const candidates = serialized.candidates as Array<Record<string, unknown>>;
      const effects = candidates[0].effects as Array<Record<string, unknown>>;
      expect(effects[0].kind).toBe(kind);
    }
  });

  it("converts nested ConditionNode in candidates via convertCondition", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: 0 },
      candidates: [
        {
          id: "c1",
          when: {
            kind: 3,
            children: [],
            term: { kind: "task", value: { taskId: "t1", state: 2 } },
          },
          rank: 1,
          effects: [],
        },
      ],
      reuse: [],
      dialog: null,
    };
    const wire = serializeDecision(def) as Record<string, unknown>;
    const candidates = wire.candidates as Array<Record<string, unknown>>;
    expect(candidates[0].when).toEqual({
      Term: { Task: { task_id: "t1", state: "Completed" } },
    });
  });

  it("handles empty candidates array", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: 0 },
      candidates: [],
      reuse: [],
      dialog: null,
    };
    const wire = serializeDecision(def) as Record<string, unknown>;
    expect(wire.candidates).toEqual([]);
  });

  it("handles dialog with InteractionTree structure", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: 2 },
      candidates: [],
      reuse: [],
      dialog: {
        node: "root",
        children: [
          { node: "child1", children: [] },
          { node: "child2", children: [] },
        ],
      },
    };
    const wire = serializeDecision(def) as Record<string, unknown>;
    expect(wire.dialog).toEqual({
      node: "root",
      children: [
        { node: "child1", children: [] },
        { node: "child2", children: [] },
      ],
    });
  });

  it("handles reuse array with multiple rules", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: 1 },
      candidates: [],
      reuse: [
        { id: "r1", when: ALWAYS_TRUE, source: { kind: "feedback" }, apply: [{ action: "increase" }] },
        { id: "r2", when: ALWAYS_TRUE, source: { kind: "history" }, apply: [{ action: "decrease" }] },
      ],
      dialog: null,
    };
    const wire = serializeDecision(def) as Record<string, unknown>;
    expect(wire.reuse).toHaveLength(2);
  });

  it("handles candidates with multiple effects", () => {
    const def: DecisionDef = {
      id: "01900000-0000-7000-8000-000000000001",
      observe: { scope: 3 },
      candidates: [
        {
          id: "c1",
          when: ALWAYS_TRUE,
          rank: 0,
          effects: [
            { kind: 0, proposal: { span: { start: "2026-07-01T00:00:00Z", end: "2026-07-01T01:00:00Z" } }, change: null, request: null },
            { kind: 1, proposal: null, change: { field: "color", value: "#ff0000" }, request: null },
            { kind: 2, proposal: null, change: null, request: { idempotencyKey: "req-123" } },
          ],
        },
      ],
      reuse: [],
      dialog: null,
    };
    const wire = serializeDecision(def) as Record<string, unknown>;
    const candidates = wire.candidates as Array<Record<string, unknown>>;
    const effects = candidates[0].effects as Array<Record<string, unknown>>;
    expect(effects).toHaveLength(3);
    expect(effects[0].kind).toBe(0);
    expect(effects[1].kind).toBe(1);
    expect(effects[2].kind).toBe(2);
  });

  it("all observe.scope values appear in random samples", () => {
    const seenScopes = new Set<number>();
    fc.assert(
      fc.property(decisionDefArb(), (def) => {
        seenScopes.add(def.observe.scope);
      }),
      { numRuns: 100 },
    );
    expect(seenScopes.has(DecisionObserveScope.PLAN)).toBe(true);
    expect(seenScopes.has(DecisionObserveScope.FRAME)).toBe(true);
    expect(seenScopes.has(DecisionObserveScope.PLACEMENT)).toBe(true);
    expect(seenScopes.has(DecisionObserveScope.EXECUTION)).toBe(true);
  });

  it("empty candidates array appears in random samples", () => {
    let seenEmpty = false;
    fc.assert(
      fc.property(decisionDefArb(), (def) => {
        if (def.candidates.length === 0) seenEmpty = true;
      }),
      { numRuns: 50 },
    );
    expect(seenEmpty).toBe(true);
  });
});
