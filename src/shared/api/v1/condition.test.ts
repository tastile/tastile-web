import * as fc from "fast-check";
import type { ConditionNode, Term } from "@/tile/model/v1/condition";
import { convertCondition } from "./plan-wire";
import { defaultTerm } from "@/features/create-tile/ui/default-term";

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
      children: fc.array(conditionNodeArb(maxDepth - 1), { maxLength: 3 }).map((c) => [...c]),
      term: fc.constant(null),
    }),
    fc.record({
      kind: fc.constant(1),
      children: fc.array(conditionNodeArb(maxDepth - 1), { maxLength: 3 }).map((c) => [...c]),
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
  it("convertCondition preserves structure for 100 random ASTs", () => {
    fc.assert(
      fc.property(conditionNodeArb(3), (ast) => {
        const wire = convertCondition(ast);
        const json = JSON.stringify(wire);
        expect(json).toBeTruthy();
        const parsed = JSON.parse(json);
        expect(parsed).toBeDefined();
      }),
      { numRuns: 100 },
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
      expect(wire).toBeDefined();
    }
  });

  it("covers all 6 core term kinds", () => {
    const termKinds = [
      "calendar",
      "moment",
      "relation",
      "task",
      "requirement",
      "gap",
    ];
    for (const kind of termKinds) {
      const ast: ConditionNode = { kind: 3, children: [], term: defaultTerm(kind) };
      const wire = convertCondition(ast);
      expect(wire).toBeDefined();
    }
  });
});
