/**
 * v1 Metric / ScalarExpression — tastile-core/v1/05-condition-and-reference.md §Metric, §ScalarExpression
 *
 * Interfaces only. No business logic.
 */

export type ScalarValue = number | string;

export interface ScalarLiteral {
  kind: "literal";
  value: ScalarValue;
}

export interface ScalarRead {
  kind: "read";
  /** Source aggregate: RECURRING=0 | PLACEMENT=1 | EXECUTION=2 | SESSION=3 */
  sourceKind: number;
  sourceId: string;
  /** Path within the aggregate (Key structure group/part). */
  group: number;
  part: number;
}

export interface ScalarAggregate {
  kind: "aggregate";
  /** COUNT=0 | SUM=1 | MIN=2 | MAX=3 | FIRST=4 | LAST=5 */
  op: number;
  over: ScalarExpression[];
}

export interface ScalarOperate {
  kind: "operate";
  /** ADD=0 | SUBTRACT=1 | MULTIPLY=2 | DIVIDE=3 | MIN=4 | MAX=5 | ABS=6 | CLAMP=7 */
  op: number;
  args: ScalarExpression[];
}

export interface ScalarChoose {
  kind: "choose";
  branches: Array<{
    when: ScalarExpression;
    then: ScalarExpression;
  }>;
  fallback: ScalarExpression;
}

export type ScalarExpression =
  | ScalarLiteral
  | ScalarRead
  | ScalarAggregate
  | ScalarOperate
  | ScalarChoose;

export interface ScalarValueRange {
  min: ScalarValue | null;
  max: ScalarValue | null;
}

export interface Metric {
  id: string;
  /** DURATION=0 | COUNT=1 | DECIMAL=2 */
  output: number;
  expression: ScalarExpression;
  limit: ScalarValueRange | null;
}
