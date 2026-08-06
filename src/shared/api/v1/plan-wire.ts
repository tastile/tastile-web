/**
 * Convert a v1 Plan from the typed QuickCreate store shape to the wire shape
 * accepted by `POST /v1/tiles/{tileId}/plan`.
 *
 * The QuickCreate store is the single source of truth for plan structure
 * (`@/lib/stores/quick-create-store.ts`). Its interfaces use camelCase
 * (`Plan.completion.timeRequirements`, `TaskDefinition.content.note`) and
 * use **internally-tagged** discriminated unions for the Condition / Term
 * trees (`{kind: 0, children: [...]}` / `{kind: "task", value: {...}}`).
 *
 * The v1 Rust server (`crates/v1/domain/src/{condition,completion}.rs`)
 * uses serde's default **externally-tagged** representation, so the wire
 * format is `{"All": [...]}` / `{"Task": {...}}`. Several field names also
 * diverge:
 *
 *   store (camelCase, internal-tag)    →  wire (snake_case, external-tag)
 *   ─────────────────────────────────    ─────────────────────────────────
 *   ConditionNode {kind: 0, children}     {"All": [<converted children>]}
 *   ConditionNode {kind: 1, children}     {"Any": [<converted children>]}
 *   ConditionNode {kind: 2, children}     {"Not": <converted single child>}
 *   ConditionNode {kind: 3, term}         {"Term": <converted term>}
 *   Term {kind: "task", value}            {"Task": <camelCase→snake_case value>}
 *   TaskContent {title, note}             TaskContent {title, description}
 *   Range-like {minMs, maxMs}             Range {min, max}
 *   TimeObservation (no `reference`)      TimeObservation {reference: null}
 *
 * `convertCompletion` walks the store `Completion` and produces the wire
 * shape. `camelToSnakeDeep` is retained as the fallback for any unknown
 * leaf fields (e.g. PlacementRule / NestingRule / DecisionDef when the
 * form is extended to set them).
 */

import type { ConditionNode, Term } from "@/tile/model/v1/condition";
import { ConditionKind } from "@/tile/model/v1/constants";
import { uuidv7 } from "@/tile/model/v1/envelope";
import { type DecisionDef, serializeDecision } from "./decision";
import type { WireCompletion, WirePlanning } from "./openapi-contract";

// ---------- UUIDv7 enforcement (v1/10 §1: identifiers are UUIDv7 only) ----------
//
// The QuickCreate store seeds convenient non-UUIDv7 ids for the default
// form (e.g. "task_default" for the first task and `tr_<random>` for the
// seeded TimeRequirement) so the in-memory editing surface stays readable.
// The Rust server, however, validates that every aggregate id is a real
// UUIDv7 and returns HTTP 422 when it sees one of these placeholders.
//
// Rewrite non-UUIDv7 ids at the wire boundary so any caller that feeds
// the store → wire converter gets a server-legal body without having to
// know about v1 invariants.

const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidv7(value: string): boolean {
  return typeof value === "string" && UUIDV7_RE.test(value);
}

// ---------- key renamer (fallback) ----------

const CAMEL_TO_SNAKE = /([a-z0-9])([A-Z])/g;

function camelToSnakeKey(key: string): string {
  return key.replace(
    CAMEL_TO_SNAKE,
    (_match, lower: string, upper: string) => `${lower}_${upper.toLowerCase()}`,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function camelToSnakeDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => camelToSnakeDeep(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[camelToSnakeKey(k)] = camelToSnakeDeep(v);
    }
    return out;
  }
  return value;
}

// ---------- Condition / Term converters ----------

/**
 * Convert a ConditionNode to the externally-tagged wire form. The Rust
 * `Condition` enum has four variants; the discriminator `kind` on the
 * store side maps to `{"All": ...}` / `{"Any": ...}` / `{"Not": ...}` /
 * `{"Term": ...}` on the wire.
 *
 * Convention used by the QuickCreate store for NOT nodes: a single-element
 * `children` array with `term: null`. Pass-through if the input is null
 * (which the API marks as no condition / impossible match).
 */
export function convertCondition(node: unknown): unknown {
  if (!isPlainObject(node)) return node;
  const kind = node.kind;
  if (kind === 0) {
    const children = ((node.children as unknown[]) ?? []).map(convertCondition);
    return { All: children };
  }
  if (kind === 1) {
    const children = ((node.children as unknown[]) ?? []).map(convertCondition);
    return { Any: children };
  }
  if (kind === 2) {
    const children = ((node.children as unknown[]) ?? []) as unknown[];
    const child = children.length > 0 ? convertCondition(children[0]) : null;
    return { Not: child };
  }
  if (kind === 3) {
    return { Term: convertTerm(node.term) };
  }
  // Unknown discriminator: pass the object through the key renamer.
  return camelToSnakeDeep(node);
}

const SNAKE_TO_CAMEL = /_([a-z0-9])/g;

function snakeToCamelKey(key: string): string {
  return key.replace(SNAKE_TO_CAMEL, (_match, letter: string) => letter.toUpperCase());
}

function snakeToCamelDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => snakeToCamelDeep(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[snakeToCamelKey(k)] = snakeToCamelDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Parse a Condition from the externally-tagged wire form back to the
 * internally-tagged store form. Inverse of `convertCondition`.
 */
export function parseCondition(wire: unknown): ConditionNode {
  if (!isPlainObject(wire)) {
    return { kind: ConditionKind.ALL, children: [], term: null };
  }
  if ("All" in wire) {
    const children = (wire.All as unknown[] ?? []).map(parseCondition);
    return { kind: ConditionKind.ALL, children, term: null };
  }
  if ("Any" in wire) {
    const children = (wire.Any as unknown[] ?? []).map(parseCondition);
    return { kind: ConditionKind.ANY, children, term: null };
  }
  if ("Not" in wire) {
    const child = wire.Not != null ? parseCondition(wire.Not) : null;
    return { kind: ConditionKind.NOT, children: child ? [child] : [], term: null };
  }
  if ("Term" in wire) {
    return { kind: ConditionKind.TERM, children: [], term: parseTerm(wire.Term) };
  }
  return { kind: ConditionKind.ALL, children: [], term: null };
}

/**
 * Parse a Term from the externally-tagged wire form back to the
 * internally-tagged store form. Inverse of `convertTerm`.
 */
export function parseTerm(wire: unknown): Term {
  if (!isPlainObject(wire)) {
    return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
  }
  const variantKey = Object.keys(wire)[0];
  if (typeof variantKey !== "string") {
    return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
  }
  const kind = variantKey[0].toLowerCase() + variantKey.slice(1);
  const rawValue = wire[variantKey];
  if (!isPlainObject(rawValue)) {
    return defaultTermParse(kind);
  }
  const camelValue = snakeToCamelDeep(rawValue) as Record<string, unknown>;
  const value = adjustTermValueParse(kind, camelValue);
  return { kind, value } as unknown as Term;
}

function defaultTermParse(kind: string): Term {
  switch (kind) {
    case "task":
      return { kind: "task", value: { taskId: "", state: 0 } };
    case "requirement":
      return { kind: "requirement", value: { requirementId: "", state: 0 } };
    case "relation":
      return { kind: "relation", value: { referenceId: "", relation: 0, windowKind: 0 } };
    case "moment":
      return { kind: "moment", value: { referenceId: null, point: null, offsetMs: 0 } };
    case "gap":
      return { kind: "gap", value: { scope: 0, leftAnchor: { referenceId: null, point: null }, rightAnchor: { referenceId: null, point: null }, size: { minMs: null, maxMs: null } } };
    case "calendar":
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
    case "fact":
      return { kind: "fact", value: { factId: "", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "", op: 0, value: null } };
    case "feedback":
      return { kind: "feedback", value: { feedbackTxnId: "", op: 0, value: null } };
    case "life":
      return { kind: "life", value: { target: "", state: 0 } };
    default:
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } };
  }
}

function adjustTermValueParse(kind: string, value: Record<string, unknown>): Record<string, unknown> {
  switch (kind) {
    case "task": {
      const stateStr = typeof value.state === "string" ? value.state : undefined;
      const stateNum = typeof value.state === "number" ? value.state : undefined;
      const state = stateStr != null
        ? (TASK_STATE_KIND_REVERSE[stateStr] ?? 0)
        : (stateNum ?? 0);
      return { taskId: value.taskId ?? "", state };
    }
    case "requirement": {
      const stateStr = typeof value.state === "string" ? value.state : undefined;
      const stateNum = typeof value.state === "number" ? value.state : undefined;
      const state = stateStr != null
        ? (REQUIREMENT_STATE_REVERSE[stateStr] ?? 0)
        : (stateNum ?? 0);
      return { requirementId: value.timeRequirement ?? value.requirementId ?? "", state };
    }
    case "relation": {
      const wkStr = typeof value.windowKind === "string" ? value.windowKind : undefined;
      const wkNum = typeof value.windowKind === "number" ? value.windowKind : undefined;
      const windowKind = wkStr != null
        ? (RELATION_WINDOW_KIND_REVERSE[wkStr] ?? 0)
        : (wkNum ?? 0);
      return { referenceId: value.referenceId ?? "", relation: value.relation ?? 0, windowKind };
    }
    case "moment": {
      return { referenceId: value.referenceId ?? null, point: value.point ?? null, offsetMs: value.offset ?? value.offsetMs ?? 0 };
    }
    default:
      return value;
  }
}

const TASK_STATE_KIND_REVERSE: Record<string, number> = {
  Visible: 0, Marked: 1, Completed: 2, NotCompleted: 3,
};
const REQUIREMENT_STATE_REVERSE: Record<string, number> = {
  Met: 0, Unmet: 1, Any: 2,
};
const RELATION_WINDOW_KIND_REVERSE: Record<string, number> = {
  Root: 0, LabelSpan: 1, ParentSpan: 2, Gap: 3,
};

/**
 * Convert a Term to the externally-tagged wire form. The Rust `Term`
 * enum has ten variants; the store uses PascalCase strings (`"task"`,
 * `"calendar"`, etc.) for the `kind` discriminator and wraps the typed
 * payload in `value`. The wire format is `{"Task": {<snake_case payload>}}`.
 */
export function convertTerm(term: unknown): unknown {
  if (!isPlainObject(term)) return term;
  const kind = term.kind;
  const value = term.value;
  if (typeof kind !== "string" || value === undefined) {
    return camelToSnakeDeep(term);
  }
  const variant = kind[0].toUpperCase() + kind.slice(1);
  const adjustedValue = adjustTermValue(kind, value);
  return { [variant]: camelToSnakeDeep(adjustedValue) };
}

// ---------- enum translations (numeric → PascalCase string) ----------
//
// Some v1 domain enums are declared with plain `#[repr(i16)]` +
// `#[derive(Serialize, Deserialize)]` instead of going through the
// `numeric_enum!` macro. Those enums use serde's default externally-
// tagged representation: unit variants serialize as the variant NAME
// as a JSON string (e.g. `"Completed"`), not the numeric discriminant.
// The store keeps numeric constants (`state: 2`) for ergonomics; this
// table translates them at the wire boundary only.

const TASK_STATE_KIND: Record<number, string> = {
  0: "Visible",
  1: "Marked",
  2: "Completed",
  3: "NotCompleted",
};
const REQUIREMENT_STATE: Record<number, string> = {
  0: "Met",
  1: "Unmet",
  2: "Any",
};
const RELATION_WINDOW_KIND: Record<number, string> = {
  0: "Root",
  1: "LabelSpan",
  2: "ParentSpan",
  3: "Gap",
};

function lookupEnum(table: Record<number, string>, value: unknown): unknown {
  if (typeof value === "number" && Object.hasOwn(table, value)) {
    return table[value];
  }
  return value;
}

function adjustTermValue(kind: string, value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  switch (kind) {
    case "task":
      return { ...value, state: lookupEnum(TASK_STATE_KIND, value.state) };
    case "requirement": {
      // Store: { requirementId, state: number } → Wire: { time_requirement, state: "Met"|"Unmet"|"Any" }
      const { requirementId, ...rest } = value as Record<string, unknown>;
      return {
        ...rest,
        time_requirement: requirementId ?? rest.requirementId,
        state: lookupEnum(REQUIREMENT_STATE, value.state),
      };
    }
    case "relation":
      return {
        ...value,
        windowKind: lookupEnum(RELATION_WINDOW_KIND, value.windowKind),
      };
    case "moment": {
      // Store: { offsetMs } → Wire: { offset } (snake: offset_ms → must be "offset")
      const { offsetMs, ...rest } = value as Record<string, unknown>;
      return {
        ...rest,
        offset: offsetMs ?? 0,
      };
    }
    default:
      return value;
  }
}

// ---------- Completion / Planning / references converters ----------

/**
 * Loose shapes — the converter handles the actual structure validation.
 * These intentionally accept any object literal that has the expected
 * store-shape fields; callers pass the typed `Plan` from the store and
 * TypeScript's structural compatibility does the rest. Tests use plain
 * literals (no `as const`) so we don't fight the literal-type widening.
 */
interface StoreTimeRequirement {
  id: string;
  observation: {
    scope: number;
    source: number;
    aggregate: number;
    quantifier?: number | null;
    reference?: string | null;
  };
  required: { minMs: number | null; maxMs: number | null };
  preferred?: unknown;
}

interface StoreTaskDefinition {
  id: string;
  content: { title: string; note: string | null };
  show?: ConditionNode | null;
  complete: ConditionNode;
  order?: Array<{
    id: string;
    targetTaskId: string;
    relation: number;
    when?: ConditionNode | null;
  }>;
}

interface StoreCompletion {
  root: ConditionNode;
  timeRequirements: StoreTimeRequirement[];
  tasks: StoreTaskDefinition[];
}

interface StorePlanning {
  placementRules: unknown[];
  nestingRules: unknown[];
  flows: unknown[];
}

interface StoreReference {
  id: string;
  target: unknown;
  pick: unknown;
  when?: ConditionNode | null;
}

export interface StorePlanInput {
  role: number;
  references: StoreReference[];
  completion: StoreCompletion;
  planning: StorePlanning;
  metrics: unknown[];
  decisions: DecisionDef[];
}

interface LocalWireCompletion {
  root: unknown;
  time_requirements: Array<{
    id: string;
    observation: {
      scope: number;
      source: number;
      aggregate: number;
      quantifier: number | null;
      reference: string | null;
    };
    required: { min: number | null; max: number | null };
    preferred: unknown;
  }>;
  tasks: Array<{
    id: string;
    content: { title: string; description: string | null };
    show: unknown;
    complete: unknown;
    order: Array<{
      id: string;
      target_task_id: string;
      relation: number;
      when: unknown;
    }>;
  }>;
}

/**
 * Convert a TimeRequirement from store shape to wire shape.
 * Standalone serializer without id/reference handling:
 * see `serializeTimeRequirement` in `./time-requirement.ts`.
 */
function convertTimeRequirement(
  tr: StoreTimeRequirement,
): LocalWireCompletion["time_requirements"][number] {
  const preferred =
    isPlainObject(tr.preferred) &&
    (Object.hasOwn(tr.preferred, "minMs") || Object.hasOwn(tr.preferred, "maxMs"))
      ? {
          min: typeof tr.preferred.minMs === "number" ? tr.preferred.minMs : null,
          max: typeof tr.preferred.maxMs === "number" ? tr.preferred.maxMs : null,
        }
      : (tr.preferred ?? null);
  return {
    id: tr.id,
    observation: {
      scope: tr.observation.scope,
      source: tr.observation.source,
      aggregate: tr.observation.aggregate,
      quantifier: tr.observation.quantifier ?? null,
      reference: tr.observation.reference ?? null,
    },
    required: {
      min: tr.required.minMs ?? null,
      max: tr.required.maxMs ?? null,
    },
    preferred,
  };
}

function convertTask(task: StoreTaskDefinition): LocalWireCompletion["tasks"][number] {
  return {
    id: task.id,
    content: {
      title: task.content.title,
      description: task.content.note ?? null,
    },
    show: task.show ? convertCondition(task.show) : null,
    complete: convertCondition(task.complete),
    order: (task.order ?? []).map((o) => ({
      id: o.id,
      target_task_id: o.targetTaskId,
      relation: o.relation,
      when: o.when ? convertCondition(o.when) : null,
    })),
  };
}

function convertCompletion(c: StoreCompletion): WireCompletion {
  return {
    root: convertCondition(c.root) as WireCompletion["root"],
    time_requirements: (c.timeRequirements ?? []).map(
      convertTimeRequirement,
    ) as WireCompletion["time_requirements"],
    tasks: (c.tasks ?? []).map(convertTask) as WireCompletion["tasks"],
  };
}

function convertReferences(refs: StoreReference[]): unknown[] {
  return refs.map((r) => ({
    id: r.id,
    target: isPlainObject(r.target) && typeof r.target.kind === "number" ? r.target.kind : r.target,
    pick: isPlainObject(r.pick)
      ? { kind: r.pick.kind, at: (r.pick as { at?: unknown }).at ?? null }
      : r.pick,
    when: r.when ? convertCondition(r.when) : null,
  }));
}

function convertConditionalRecord(value: unknown): unknown {
  if (!isPlainObject(value)) return camelToSnakeDeep(value);
  const converted = camelToSnakeDeep(value) as Record<string, unknown>;
  if ("when" in value) {
    converted.when = value.when ? convertCondition(value.when) : null;
  }
  return converted;
}

function convertPlacementRule(value: unknown): unknown {
  if (!isPlainObject(value)) return camelToSnakeDeep(value);
  const converted = convertConditionalRecord(value) as Record<string, unknown>;
  if (isPlainObject(value.effect)) {
    const effect = converted.effect as Record<string, unknown>;
    if (isPlainObject(value.effect.span)) {
      effect.span = {
        min: typeof value.effect.span.minMs === "number" ? value.effect.span.minMs : null,
        max: typeof value.effect.span.maxMs === "number" ? value.effect.span.maxMs : null,
      };
    }
    converted.effect = effect;
  }
  return converted;
}

/**
 * Wire payload for `POST /v1/tiles/{tileId}/plan`.  Conforms to
 * `SchedulePlanDefinitionSchema` from tastile-core OpenAPI.
 */
export interface WireSetPlanBody {
  role: number;
  references: unknown[];
  completion: WireCompletion;
  planning: WirePlanning;
  metrics: unknown[];
  decisions: unknown[];
}

/**
 * Convert the typed QuickCreate store Plan into the wire shape.
 *
 * This is the only place where the store↔wire translation lives.
 * Callers (`setPlanCommand`) MUST pass the full store Plan object
 * (not a partial); the converter is not defensive about missing
 * fields because every QuickCreate mount populates them.
 */
export function toWireSetPlanBody(storePlan: StorePlanInput): WireSetPlanBody {
  const normalised = normaliseIds(storePlan);
  return {
    role: normalised.role,
    references: convertReferences(normalised.references ?? []),
    completion: convertCompletion(normalised.completion),
    planning: {
      placement_rules: (normalised.planning?.placementRules ?? []).map(
        convertPlacementRule,
      ) as WirePlanning["placement_rules"],
      nesting_rules: (normalised.planning?.nestingRules ?? []).map(
        convertConditionalRecord,
      ) as WirePlanning["nesting_rules"],
    },
    metrics: camelToSnakeDeep(normalised.metrics ?? []) as unknown[],
    decisions: (normalised.decisions ?? []).map(serializeDecision),
  };
}

/**
 * Walk the store Plan and replace every non-UUIDv7 aggregate id with a
 * freshly generated UUIDv7 string. Internal references inside condition
 * trees (`TaskTerm.taskId`, `TaskOrderRelation.targetTaskId`,
 * `RelationTerm.referenceId`) are rewritten in lockstep so the wire body
 * stays self-consistent.
 *
 * No-op when every id is already a UUIDv7.
 */
function normaliseIds(plan: StorePlanInput): StorePlanInput {
  const taskIdMap = new Map<string, string>();
  const referenceIdMap = new Map<string, string>();
  const orderIdMap = new Map<string, string>();

  const tasks = (plan.completion.tasks ?? []).map((t) => {
    if (isUuidv7(t.id)) return t;
    const fresh = uuidv7();
    taskIdMap.set(t.id, fresh);
    return { ...t, id: fresh };
  });

  const references = (plan.references ?? []).map((r) => {
    if (isUuidv7(r.id)) return r;
    const fresh = uuidv7();
    referenceIdMap.set(r.id, fresh);
    return { ...r, id: fresh };
  });

  const timeRequirements = (plan.completion.timeRequirements ?? []).map((tr) => {
    if (isUuidv7(tr.id)) return tr;
    return { ...tr, id: uuidv7() };
  });

  const rewriteTermRefs = (node: ConditionNode): ConditionNode => {
    if (!node) return node;
    const children = node.children?.map(rewriteTermRefs);
    const term = rewriteTermRefsInTerm(node.term);
    return children || term !== node.term ? { ...node, children: children ?? [], term } : node;
  };

  const rewriteTermRefsInTerm = (term: Term | null): Term | null => {
    if (!term) return term;
    if (term.kind === "task") {
      const newId = taskIdMap.get(term.value.taskId);
      if (newId) {
        return {
          ...term,
          value: { ...term.value, taskId: newId },
        };
      }
      return term;
    }
    if (term.kind === "relation") {
      const newId = referenceIdMap.get(term.value.referenceId);
      if (newId) {
        return {
          ...term,
          value: { ...term.value, referenceId: newId },
        };
      }
      return term;
    }
    return term;
  };

  const rewriteOrder = (
    order: NonNullable<StoreTaskDefinition["order"]>,
  ): NonNullable<StoreTaskDefinition["order"]> =>
    order.map((o) => {
      let next = o;
      if (!isUuidv7(o.id)) {
        const fresh = uuidv7();
        orderIdMap.set(o.id, fresh);
        next = { ...next, id: fresh };
      }
      const targetNew = taskIdMap.get(o.targetTaskId);
      if (targetNew) {
        next = { ...next, targetTaskId: targetNew };
      }
      const whenNew = o.when ? rewriteTermRefs(o.when) : o.when;
      if (whenNew !== o.when) {
        next = { ...next, when: whenNew };
      }
      return next;
    });

  const newTasks = tasks.map((t) => ({
    ...t,
    complete: rewriteTermRefs(t.complete),
    show: t.show ? rewriteTermRefs(t.show) : t.show,
    order: t.order ? rewriteOrder(t.order) : t.order,
  }));

  const newReferences = references.map((r) =>
    r.when ? { ...r, when: rewriteTermRefs(r.when) } : r,
  );

  const rootChanged =
    plan.completion.root && (plan.completion.root.children?.length ?? 0) > 0
      ? rewriteTermRefs(plan.completion.root)
      : plan.completion.root;
  const rootIsNewRoot = rootChanged !== plan.completion.root;

  const completionChanged =
    rootIsNewRoot ||
    newTasks !== plan.completion.tasks ||
    timeRequirements !== plan.completion.timeRequirements;

  if (!completionChanged && newReferences === plan.references) {
    return plan;
  }

  return {
    ...plan,
    references: newReferences,
    completion: {
      ...plan.completion,
      root: completionChanged ? rootChanged : plan.completion.root,
      tasks: newTasks,
      timeRequirements,
    },
  };
}
