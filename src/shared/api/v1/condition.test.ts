import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import type { ConditionNode, Term } from "@/tile/model/v1/condition";
import { convertCondition, convertTerm, parseCondition, parseTerm } from "./plan-wire";

const hexChar = fc.constantFrom(..."0123456789abcdef".split(""));

function uuidv7Like(): string {
  const h = fc.sample(fc.string({ unit: hexChar, minLength: 32, maxLength: 32 }), 1)[0];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const uuidv7Arb = fc.constant(null).map(() => uuidv7Like());

function termArb(): fc.Arbitrary<Term> {
  return fc.oneof(
    fc.record({
      kind: fc.constant("calendar" as const),
      value: fc.record({
        weekdayMask: fc.integer({ min: 0, max: 127 }),
        timeStart: fc.option(fc.constant("09:00" as string), { nil: null }),
        timeEnd: fc.option(fc.constant("18:00" as string), { nil: null }),
        holidayKind: fc.constantFrom(0, 1, 2),
        dateRange: fc.constant(null),
        offsetMin: fc.integer({ min: -720, max: 720 }),
      }),
    }),
    fc.record({
      kind: fc.constant("moment" as const),
      value: fc.record({
        referenceId: fc.option(uuidv7Arb, { nil: null }) as fc.Arbitrary<string | null>,
        point: fc.option(fc.integer(), { nil: null }),
        offsetMs: fc.integer(),
      }),
    }),
    fc.record({
      kind: fc.constant("relation" as const),
      value: fc.record({
        referenceId: uuidv7Arb,
        relation: fc.constantFrom(0, 1, 2, 3, 4),
        windowKind: fc.constantFrom(0, 1, 2, 3),
      }),
    }),
    fc.record({
      kind: fc.constant("task" as const),
      value: fc.record({
        taskId: uuidv7Arb,
        state: fc.constantFrom(0, 1, 2, 3),
      }),
    }),
    fc.record({
      kind: fc.constant("requirement" as const),
      value: fc.record({
        requirementId: uuidv7Arb,
        state: fc.constantFrom(0, 1),
      }),
    }),
    fc.record({
      kind: fc.constant("gap" as const),
      value: fc.record({
        scope: fc.constantFrom(0, 1, 2, 3, 4),
        leftAnchor: fc.record({
          referenceId: fc.option(uuidv7Arb, { nil: null }) as fc.Arbitrary<string | null>,
          point: fc.option(fc.integer(), { nil: null }),
        }),
        rightAnchor: fc.record({
          referenceId: fc.option(uuidv7Arb, { nil: null }) as fc.Arbitrary<string | null>,
          point: fc.option(fc.integer(), { nil: null }),
        }),
        size: fc.option(
          fc.record({
            minMs: fc.option(fc.integer({ min: 0 }), { nil: null }),
            maxMs: fc.option(fc.integer({ min: 0 }), { nil: null }),
          }),
          { nil: null },
        ),
      }),
    }),
    fc.record({
      kind: fc.constant("fact" as const),
      value: fc.record({
        factId: uuidv7Arb,
        op: fc.constantFrom(0, 1, 2, 3),
        value: fc.option(fc.oneof(fc.integer(), fc.constant(null)), { nil: null }),
      }),
    }),
    fc.record({
      kind: fc.constant("metric" as const),
      value: fc.record({
        metricId: uuidv7Arb,
        op: fc.constantFrom(0, 1, 2, 3),
        value: fc.option(fc.oneof(fc.integer(), fc.constant(null)), { nil: null }),
      }),
    }),
    fc.record({
      kind: fc.constant("feedback" as const),
      value: fc.record({
        feedbackTxnId: uuidv7Arb,
        op: fc.constantFrom(0, 1, 2, 3),
        value: fc.option(fc.oneof(fc.integer(), fc.constant(null)), { nil: null }),
      }),
    }),
    fc.record({
      kind: fc.constant("life" as const),
      value: fc.record({
        target: uuidv7Arb,
        state: fc.constantFrom(0, 1, 2),
      }),
    }),
  );
}

function conditionNodeArb(maxDepth: number): fc.Arbitrary<ConditionNode> {
  if (maxDepth <= 0) {
    return fc.record({
      kind: fc.constant(3),
      children: fc.constant([] as ConditionNode[]),
      term: termArb(),
    });
  }
  return fc.oneof(
    fc.record({
      kind: fc.constant(3),
      children: fc.constant([] as ConditionNode[]),
      term: termArb(),
    }),
    fc.record({
      kind: fc.constant(0),
      children: fc.array(conditionNodeArb(maxDepth - 1), { minLength: 1, maxLength: 3 }).map((c) => [...c]),
      term: fc.constant(null),
    }),
    fc.record({
      kind: fc.constant(1),
      children: fc.array(conditionNodeArb(maxDepth - 1), { minLength: 1, maxLength: 3 }).map((c) => [...c]),
      term: fc.constant(null),
    }),
    fc.record({
      kind: fc.constant(2),
      children: fc.tuple(conditionNodeArb(maxDepth - 1)).map((c) => [...c]),
      term: fc.constant(null),
    }),
  );
}

describe("Condition AST ser/de round-trip", () => {
  it("parseCondition(convertCondition(ast)) deep-equals ast for 100 random ASTs", () => {
    fc.assert(
      fc.property(conditionNodeArb(3), (ast) => {
        const wire = convertCondition(ast);
        const back = parseCondition(wire);
        expect(JSON.parse(JSON.stringify(back))).toEqual(
          JSON.parse(JSON.stringify(ast)),
        );
      }),
      { numRuns: 100, endOnFailure: true },
    );
  });

  it("parseTerm(convertTerm(term)) deep-equals term for 100 random terms", () => {
    fc.assert(
      fc.property(termArb(), (term) => {
        const wire = convertTerm(term);
        const back = parseTerm(wire);
        expect(JSON.parse(JSON.stringify(back))).toEqual(
          JSON.parse(JSON.stringify(term)),
        );
      }),
      { numRuns: 100, endOnFailure: true },
    );
  });

  it("covers all 4 operators", () => {
    for (const kind of [0, 1, 2, 3]) {
      const ast: ConditionNode =
        kind === 3
          ? {
              kind: 3,
              children: [],
              term: {
                kind: "calendar",
                value: {
                  weekdayMask: 0,
                  timeStart: null,
                  timeEnd: null,
                  holidayKind: 2,
                  dateRange: null,
                  offsetMin: 0,
                },
              },
            }
          : {
              kind: kind as 0 | 1 | 2,
              children: [
                {
                  kind: 3,
                  children: [],
                  term: {
                    kind: "task",
                    value: {
                      taskId: "01900000-0000-7000-8000-000000000001",
                      state: 0,
                    },
                  },
                },
              ],
              term: null,
            };
      const wire = convertCondition(ast);
      const back = parseCondition(wire);
      expect(JSON.parse(JSON.stringify(back))).toEqual(
        JSON.parse(JSON.stringify(ast)),
      );
    }
  });

  it("covers all 9 store-side term kinds in round-trip", () => {
    const termKinds = [
      "calendar",
      "moment",
      "relation",
      "task",
      "requirement",
      "gap",
      "fact",
      "metric",
      "feedback",
      "life",
    ];
    for (const kind of termKinds) {
      const term = makeTermForKind(kind);
      const wire = convertTerm(term);
      const back = parseTerm(wire);
      expect(back.kind).toBe(term.kind);
    }
  });

  it("hand-picked fixture: ALL with two TERM children", () => {
    const ast: ConditionNode = {
      kind: 0,
      children: [
        {
          kind: 3,
          children: [],
          term: { kind: "task", value: { taskId: "01900000-0000-7000-8000-000000000001", state: 2 } },
        },
        {
          kind: 3,
          children: [],
          term: { kind: "metric", value: { metricId: "01900000-0000-7000-8000-000000000002", op: 0, value: 100 } },
        },
      ],
      term: null,
    };
    const wire = convertCondition(ast);
    const back = parseCondition(wire);
    expect(JSON.parse(JSON.stringify(back))).toEqual(
      JSON.parse(JSON.stringify(ast)),
    );
  });

  it("hand-picked fixture: NOT wrapping TERM", () => {
    const ast: ConditionNode = {
      kind: 2,
      children: [
        {
          kind: 3,
          children: [],
          term: { kind: "calendar", value: { weekdayMask: 0b1111111, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } },
        },
      ],
      term: null,
    };
    const wire = convertCondition(ast);
    const back = parseCondition(wire);
    expect(JSON.parse(JSON.stringify(back))).toEqual(
      JSON.parse(JSON.stringify(ast)),
    );
  });

  it("hand-picked fixture: nested ANY > ALL > TERM", () => {
    const ast: ConditionNode = {
      kind: 1,
      children: [
        {
          kind: 0,
          children: [
            {
              kind: 3,
              children: [],
              term: { kind: "gap", value: { scope: 2, leftAnchor: { referenceId: null, point: null }, rightAnchor: { referenceId: null, point: null }, size: { minMs: 60000, maxMs: 3600000 } } },
            },
          ],
          term: null,
        },
      ],
      term: null,
    };
    const wire = convertCondition(ast);
    const back = parseCondition(wire);
    expect(JSON.parse(JSON.stringify(back))).toEqual(
      JSON.parse(JSON.stringify(ast)),
    );
  });
});

function makeTermForKind(kind: string): Term {
  switch (kind) {
    case "calendar":
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
    case "moment":
      return { kind: "moment", value: { referenceId: null, point: null, offsetMs: 0 } };
    case "relation":
      return { kind: "relation", value: { referenceId: "01900000-0000-7000-8000-000000000001", relation: 0, windowKind: 0 } };
    case "task":
      return { kind: "task", value: { taskId: "01900000-0000-7000-8000-000000000001", state: 0 } };
    case "requirement":
      return { kind: "requirement", value: { requirementId: "01900000-0000-7000-8000-000000000001", state: 0 } };
    case "gap":
      return { kind: "gap", value: { scope: 0, leftAnchor: { referenceId: null, point: null }, rightAnchor: { referenceId: null, point: null }, size: { minMs: null, maxMs: null } } };
    case "fact":
      return { kind: "fact", value: { factId: "01900000-0000-7000-8000-000000000001", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "01900000-0000-7000-8000-000000000001", op: 0, value: null } };
    case "feedback":
      return { kind: "feedback", value: { feedbackTxnId: "01900000-0000-7000-8000-000000000001", op: 0, value: null } };
    case "life":
      return { kind: "life", value: { target: "01900000-0000-7000-8000-000000000001", state: 0 } };
    default:
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
  }
}
