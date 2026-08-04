import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import type { ConditionNode } from "@/tile/model/v1/condition";
import type {
  Metric,
  ScalarExpression,
  ScalarValue,
  ReadExpression,
  AggregateExpression,
  OperateExpression,
  ChooseExpression,
} from "./metric";
import {
  serializeMetric,
  MetricOutput,
  ScalarExpressionKind,
  AggregateKind,
  OperatorKind,
} from "./metric";

// ---------- Arbitraries ----------

const hexChar = fc.constantFrom(..."0123456789abcdef".split(""));
const hexStr = (n: number) =>
  fc.array(hexChar, { minLength: n, maxLength: n }).map((a) => a.join(""));

const uuidv7Arb = hexStr(32).map(
  (h) =>
    `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`,
);

const conditionNodeArb: fc.Arbitrary<ConditionNode> = fc.constant({
  kind: 0,
  children: [],
  term: null,
});

function scalarExprArb(depth: number): fc.Arbitrary<ScalarExpression> {
  if (depth <= 0) {
    return fc.record({
      kind: fc.constant(ScalarExpressionKind.LITERAL),
      value: fc.oneof(
        fc.integer({ min: -10000, max: 10000 }),
        fc.constant(null),
      ),
    });
  }
  return fc.oneof(
    // LITERAL
    fc.record({
      kind: fc.constant(ScalarExpressionKind.LITERAL),
      value: fc.oneof(
        fc.integer({ min: -10000, max: 10000 }),
        fc.constant(null),
      ),
    }) as fc.Arbitrary<ScalarExpression>,
    // READ
    fc.record({
      kind: fc.constant(ScalarExpressionKind.READ),
      target: uuidv7Arb,
      field: fc.constantFrom("duration", "count", "value", "score"),
    }) as fc.Arbitrary<ScalarExpression>,
    // AGGREGATE
    fc.record({
      kind: fc.constant(ScalarExpressionKind.AGGREGATE),
      aggregate: fc.constantFrom(
        AggregateKind.COUNT,
        AggregateKind.SUM,
        AggregateKind.MIN,
        AggregateKind.MAX,
        AggregateKind.FIRST,
        AggregateKind.LAST,
      ),
      filter: fc.oneof(conditionNodeArb, fc.constant(null)),
    }) as fc.Arbitrary<ScalarExpression>,
    // OPERATE (recursive, depth-limited)
    scalarExprArb(depth - 1).chain((left) =>
      scalarExprArb(depth - 1).map(
        (right): OperateExpression => ({
          kind: ScalarExpressionKind.OPERATE,
          operator: fc.sample(
            fc.constantFrom(
              OperatorKind.ADD,
              OperatorKind.SUBTRACT,
              OperatorKind.MULTIPLY,
              OperatorKind.DIVIDE,
              OperatorKind.MIN,
              OperatorKind.MAX,
              OperatorKind.ABS,
              OperatorKind.CLAMP,
            ),
            1,
          )[0],
          left,
          right,
        }),
      ),
    ),
    // CHOOSE (depth-limited)
    scalarExprArb(depth - 1).chain((fallback) =>
      fc
        .array(
          fc.record({
            when: conditionNodeArb,
            then: scalarExprArb(depth - 1),
          }),
          { maxLength: 3 },
        )
        .map(
          (branches): ChooseExpression => ({
            kind: ScalarExpressionKind.CHOOSE,
            branches,
            fallback,
          }),
        ),
    ),
  );
}

function metricArb(): fc.Arbitrary<Metric> {
  return fc.record({
    id: uuidv7Arb,
    output: fc.constantFrom(
      MetricOutput.DURATION,
      MetricOutput.COUNT,
      MetricOutput.DECIMAL,
    ),
    expression: scalarExprArb(2),
    limit: fc.oneof(
      fc.constant(null),
      fc.record({
        min: fc.oneof(
          fc.integer({ min: 0, max: 10000 }),
          fc.constant(null),
        ),
        max: fc.oneof(
          fc.integer({ min: 0, max: 10000 }),
          fc.constant(null),
        ),
      }),
    ),
  });
}

// ---------- Tests ----------

describe("Metric type constants", () => {
  it("MetricOutput values match v1/05", () => {
    expect(MetricOutput.DURATION).toBe(0);
    expect(MetricOutput.COUNT).toBe(1);
    expect(MetricOutput.DECIMAL).toBe(2);
  });

  it("ScalarExpressionKind values match v1/05", () => {
    expect(ScalarExpressionKind.LITERAL).toBe(0);
    expect(ScalarExpressionKind.READ).toBe(1);
    expect(ScalarExpressionKind.AGGREGATE).toBe(2);
    expect(ScalarExpressionKind.OPERATE).toBe(3);
    expect(ScalarExpressionKind.CHOOSE).toBe(4);
  });

  it("AggregateKind values match v1/05", () => {
    expect(AggregateKind.COUNT).toBe(0);
    expect(AggregateKind.SUM).toBe(1);
    expect(AggregateKind.MIN).toBe(2);
    expect(AggregateKind.MAX).toBe(3);
    expect(AggregateKind.FIRST).toBe(4);
    expect(AggregateKind.LAST).toBe(5);
  });

  it("OperatorKind values match v1/05", () => {
    expect(OperatorKind.ADD).toBe(0);
    expect(OperatorKind.SUBTRACT).toBe(1);
    expect(OperatorKind.MULTIPLY).toBe(2);
    expect(OperatorKind.DIVIDE).toBe(3);
    expect(OperatorKind.MIN).toBe(4);
    expect(OperatorKind.MAX).toBe(5);
    expect(OperatorKind.ABS).toBe(6);
    expect(OperatorKind.CLAMP).toBe(7);
  });
});

describe("serializeMetric", () => {
  it("converts LITERAL expression to externally-tagged form", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.COUNT,
      expression: { kind: ScalarExpressionKind.LITERAL, value: 42 },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.id).toBe(metric.id);
    expect(wire.output).toBe(1);
    expect(wire.expression).toEqual({ LITERAL: { value: 42 } });
    expect(wire.limit).toBeNull();
  });

  it("converts READ expression to externally-tagged form", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.DECIMAL,
      expression: {
        kind: ScalarExpressionKind.READ,
        target: "01900000-0000-7000-8000-000000000099",
        field: "duration",
      },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.expression).toEqual({
      READ: {
        target: "01900000-0000-7000-8000-000000000099",
        field: "duration",
      },
    });
  });

  it("converts AGGREGATE expression with null filter", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.COUNT,
      expression: {
        kind: ScalarExpressionKind.AGGREGATE,
        aggregate: AggregateKind.SUM,
        filter: null,
      },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.expression).toEqual({
      AGGREGATE: { aggregate: 1, filter: null },
    });
  });

  it("converts AGGREGATE expression with condition filter", () => {
    const filter: ConditionNode = {
      kind: 3,
      children: [],
      term: { kind: "task", value: { taskId: "t1", state: 2 } },
    };
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.COUNT,
      expression: {
        kind: ScalarExpressionKind.AGGREGATE,
        aggregate: AggregateKind.COUNT,
        filter,
      },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    const expr = wire.expression as Record<string, unknown>;
    expect(expr.AGGREGATE).toBeDefined();
    const agg = expr.AGGREGATE as Record<string, unknown>;
    expect(agg.aggregate).toBe(0);
    expect(agg.filter).toEqual({
      Term: { Task: { task_id: "t1", state: "Completed" } },
    });
  });

  it("converts OPERATE expression recursively", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.DURATION,
      expression: {
        kind: ScalarExpressionKind.OPERATE,
        operator: OperatorKind.ADD,
        left: { kind: ScalarExpressionKind.LITERAL, value: 10 },
        right: { kind: ScalarExpressionKind.LITERAL, value: 20 },
      },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.expression).toEqual({
      OPERATE: {
        operator: 0,
        left: { LITERAL: { value: 10 } },
        right: { LITERAL: { value: 20 } },
      },
    });
  });

  it("converts CHOOSE expression with branches", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.DECIMAL,
      expression: {
        kind: ScalarExpressionKind.CHOOSE,
        branches: [
          {
            when: { kind: 0, children: [], term: null },
            then: { kind: ScalarExpressionKind.LITERAL, value: 100 },
          },
        ],
        fallback: { kind: ScalarExpressionKind.LITERAL, value: 0 },
      },
      limit: null,
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.expression).toEqual({
      CHOOSE: {
        branches: [
          {
            when: { All: [] },
            then: { LITERAL: { value: 100 } },
          },
        ],
        fallback: { LITERAL: { value: 0 } },
      },
    });
  });

  it("preserves limit field", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.DECIMAL,
      expression: { kind: ScalarExpressionKind.LITERAL, value: 1 },
      limit: { min: 0, max: 100 },
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    expect(wire.limit).toEqual({ min: 0, max: 100 });
  });
});

describe("Metric ser/de round-trip", () => {
  it("serializeMetric produces valid JSON (50 random metrics)", () => {
    fc.assert(
      fc.property(metricArb(), (metric) => {
        const serialized = serializeMetric(metric);
        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(serialized);
      }),
      { numRuns: 50 },
    );
  });

  it("covers all MetricOutput values", () => {
    for (const output of [
      MetricOutput.DURATION,
      MetricOutput.COUNT,
      MetricOutput.DECIMAL,
    ]) {
      const metric: Metric = {
        id: "01900000-0000-7000-8000-000000000001",
        output,
        expression: { kind: ScalarExpressionKind.LITERAL, value: 42 },
        limit: null,
      };
      const serialized = serializeMetric(metric) as Record<string, unknown>;
      expect(serialized.output).toBe(output);
    }
  });

  it("covers all ScalarExpressionKind values", () => {
    // LITERAL
    const literal: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: 0,
      expression: { kind: 0, value: 100 },
      limit: null,
    };
    expect(() => serializeMetric(literal)).not.toThrow();

    // READ
    const read: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: 0,
      expression: { kind: 1, target: "01900000-0000-7000-8000-000000000099", field: "duration" },
      limit: null,
    };
    expect(() => serializeMetric(read)).not.toThrow();

    // AGGREGATE
    const aggregate: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: 1,
      expression: { kind: 2, aggregate: 0, filter: null },
      limit: null,
    };
    expect(() => serializeMetric(aggregate)).not.toThrow();

    // OPERATE
    const operate: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: 2,
      expression: {
        kind: 3,
        operator: 0,
        left: { kind: 0, value: 1 },
        right: { kind: 0, value: 2 },
      },
      limit: null,
    };
    expect(() => serializeMetric(operate)).not.toThrow();

    // CHOOSE
    const choose: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: 0,
      expression: {
        kind: 4,
        branches: [
          {
            when: { kind: 0, children: [], term: null },
            then: { kind: 0, value: 10 },
          },
        ],
        fallback: { kind: 0, value: 0 },
      },
      limit: null,
    };
    expect(() => serializeMetric(choose)).not.toThrow();
  });

  it("serializes nested OPERATE expression", () => {
    const metric: Metric = {
      id: "01900000-0000-7000-8000-000000000001",
      output: MetricOutput.DURATION,
      expression: {
        kind: ScalarExpressionKind.OPERATE,
        operator: OperatorKind.MULTIPLY,
        left: {
          kind: ScalarExpressionKind.READ,
          target: "01900000-0000-7000-8000-000000000099",
          field: "duration",
        },
        right: {
          kind: ScalarExpressionKind.LITERAL,
          value: 2,
        },
      },
      limit: { min: 0, max: 7200000 },
    };
    const wire = serializeMetric(metric) as Record<string, unknown>;
    const expr = wire.expression as Record<string, unknown>;
    expect(expr.OPERATE).toBeDefined();
    const op = expr.OPERATE as Record<string, unknown>;
    expect(op.operator).toBe(2); // MULTIPLY
    expect(op.left).toEqual({
      READ: {
        target: "01900000-0000-7000-8000-000000000099",
        field: "duration",
      },
    });
    expect(op.right).toEqual({ LITERAL: { value: 2 } });
  });
});
