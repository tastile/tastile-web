/**
 * Metric TypeScript types and serializer.
 *
 * Matches the Rust spec at tastile-core/v1/05-condition-and-reference.md
 * (lines 194–303). Metric is a derived value — no stored state, computed
 * from Execution segments via ScalarExpression trees.
 */

import type { ConditionNode } from "@/tile/model/v1/condition";
import { convertCondition } from "./plan-wire";

// ---------- Metric.output numeric constants (v1/05 §Metric) ----------

export const MetricOutput = {
  DURATION: 0,
  COUNT: 1,
  DECIMAL: 2,
} as const;

// ---------- ScalarExpression.kind numeric constants (v1/05 §ScalarExpression) ----------

export const ScalarExpressionKind = {
  LITERAL: 0,
  READ: 1,
  AGGREGATE: 2,
  OPERATE: 3,
  CHOOSE: 4,
} as const;

// ---------- Aggregate function kinds (v1/05 §AGGREGATE) ----------

export const AggregateKind = {
  COUNT: 0,
  SUM: 1,
  MIN: 2,
  MAX: 3,
  FIRST: 4,
  LAST: 5,
} as const;

// ---------- Operator kinds (v1/05 §OPERATE) ----------

export const OperatorKind = {
  ADD: 0,
  SUBTRACT: 1,
  MULTIPLY: 2,
  DIVIDE: 3,
  MIN: 4,
  MAX: 5,
  ABS: 6,
  CLAMP: 7,
} as const;

// ---------- ScalarExpression variants ----------

export interface ScalarValue {
  kind: number; // 0 = LITERAL
  value: number | string | null;
}

export interface ReadExpression {
  kind: number; // 1 = READ
  target: string;
  field: string;
}

export interface AggregateExpression {
  kind: number; // 2 = AGGREGATE
  aggregate: number; // AggregateKind
  filter: ConditionNode | null;
}

export interface OperateExpression {
  kind: number; // 3 = OPERATE
  operator: number; // OperatorKind
  left: ScalarExpression;
  right: ScalarExpression;
}

export interface ChooseExpression {
  kind: number; // 4 = CHOOSE
  branches: Array<{ when: ConditionNode; then: ScalarExpression }>;
  fallback: ScalarExpression;
}

export type ScalarExpression =
  | ScalarValue
  | ReadExpression
  | AggregateExpression
  | OperateExpression
  | ChooseExpression;

// ---------- Metric ----------

export interface Metric {
  id: string;
  output: number; // MetricOutput
  expression: ScalarExpression;
  limit: { min: number | null; max: number | null } | null;
}

// ---------- Serializer ----------

function serializeExpression(expr: ScalarExpression): unknown {
  switch (expr.kind) {
    case ScalarExpressionKind.LITERAL:
      return { LITERAL: { value: (expr as ScalarValue).value } };
    case ScalarExpressionKind.READ: {
      const e = expr as ReadExpression;
      return { READ: { target: e.target, field: e.field } };
    }
    case ScalarExpressionKind.AGGREGATE: {
      const e = expr as AggregateExpression;
      return {
        AGGREGATE: {
          aggregate: e.aggregate,
          filter: e.filter ? convertCondition(e.filter) : null,
        },
      };
    }
    case ScalarExpressionKind.OPERATE: {
      const e = expr as OperateExpression;
      return {
        OPERATE: {
          operator: e.operator,
          left: serializeExpression(e.left),
          right: serializeExpression(e.right),
        },
      };
    }
    case ScalarExpressionKind.CHOOSE: {
      const e = expr as ChooseExpression;
      return {
        CHOOSE: {
          branches: e.branches.map((b) => ({
            when: convertCondition(b.when),
            then: serializeExpression(b.then),
          })),
          fallback: serializeExpression(e.fallback),
        },
      };
    }
    default:
      return expr;
  }
}

/**
 * Convert a Metric from store shape (camelCase, internally-tagged)
 * to wire shape (externally-tagged ScalarExpression, ConditionNode
 * converted to external-tag form).
 */
export function serializeMetric(metric: Metric): unknown {
  return {
    id: metric.id,
    output: metric.output,
    expression: serializeExpression(metric.expression),
    limit: metric.limit,
  };
}
