/**
 * Unit tests for the v1 plan wire conversion (`toWireSetPlanBody`).
 *
 * The QuickCreate store uses camelCase keys (Plan.completion.timeRequirements,
 * TaskDefinition.content.note) AND internally-tagged discriminated unions
 * for the Condition / Term trees. The v1 server expects snake_case keys
 * with externally-tagged enum representations (Condition::All →
 * `{"All": [...]}`, Term::Task → `{"Task": {task_id, state}}`).
 *
 * These tests pin the structural rewrite so a regression in either the
 * conversion or the store shape is caught early — without going through
 * the full QuickCreate submit flow.
 */

import { describe, expect, it } from "vitest";

import {
  type StorePlanInput,
  camelToSnakeDeep,
  convertCondition,
  convertTerm,
  toWireSetPlanBody,
} from "./plan-wire";

// Stable UUIDv7-shaped ids for the existing conversion tests. The wire
// boundary regenerates non-UUIDv7 ids so a regression in *conversion* is
// best isolated from a regression in *id regeneration*; the latter is
// pinned in `normalises non-UUIDv7 ids` below.
const TASK_DEFAULT_ID = "01900000-0000-7000-8000-000000000abc";
const TIME_REQ_ID = "01900000-0000-7000-8000-000000000def";
const REF_ID = "01900000-0000-7000-8000-000000000123";

describe("camelToSnakeDeep", () => {
  it("converts top-level camelCase keys to snake_case", () => {
    expect(camelToSnakeDeep({ timeRequirements: [], taskList: [] })).toEqual({
      time_requirements: [],
      task_list: [],
    });
  });

  it("recurses into nested objects", () => {
    expect(
      camelToSnakeDeep({
        content: { title: "x", noteToSelf: "y" },
      }),
    ).toEqual({
      content: { title: "x", note_to_self: "y" },
    });
  });

  it("recurses into arrays of objects", () => {
    expect(
      camelToSnakeDeep({
        tasks: [
          { id: "a", complete: { kind: 3, children: [] } },
          { id: "b", complete: { kind: 3, children: [] } },
        ],
      }),
    ).toEqual({
      tasks: [
        { id: "a", complete: { kind: 3, children: [] } },
        { id: "b", complete: { kind: 3, children: [] } },
      ],
    });
  });

  it("preserves primitive values", () => {
    expect(camelToSnakeDeep(42)).toBe(42);
    expect(camelToSnakeDeep("hello")).toBe("hello");
    expect(camelToSnakeDeep(null)).toBe(null);
    expect(camelToSnakeDeep(undefined)).toBe(undefined);
  });

  it("does not double-rewrite already snake_case keys", () => {
    expect(camelToSnakeDeep({ time_requirements: [], placement_rules: [] })).toEqual({
      time_requirements: [],
      placement_rules: [],
    });
  });
});

describe("convertTerm (internally-tagged → externally-tagged wire form)", () => {
  it("converts a TaskTerm", () => {
    expect(
      convertTerm({ kind: "task", value: { taskId: "task_default", state: 2 } }),
    ).toEqual({
      Task: { task_id: "task_default", state: "Completed" },
    });
  });

  it("converts a CalendarTerm", () => {
    expect(
      convertTerm({
        kind: "calendar",
        value: {
          weekdayMask: 0b0011111,
          timeStart: null,
          timeEnd: null,
          holidayKind: 2,
          dateRange: null,
          offsetMin: 0,
        },
      }),
    ).toEqual({
      Calendar: {
        weekday_mask: 0b0011111,
        time_start: null,
        time_end: null,
        holiday_kind: 2,
        date_range: null,
        offset_min: 0,
      },
    });
  });

  it("converts a GapTerm with nested AnchorSelectors", () => {
    expect(
      convertTerm({
        kind: "gap",
        value: {
          scope: 0,
          leftAnchor: { referenceId: "ref-a", point: 0 },
          rightAnchor: { referenceId: "ref-b", point: 1 },
          size: { minMs: 600_000, maxMs: 3_600_000 },
        },
      }),
    ).toEqual({
      Gap: {
        scope: 0,
        left_anchor: { reference_id: "ref-a", point: 0 },
        right_anchor: { reference_id: "ref-b", point: 1 },
        size: { min_ms: 600_000, max_ms: 3_600_000 },
      },
    });
  });

  it("passes through a non-Term object via camelToSnakeDeep", () => {
    expect(convertTerm({ arbitraryKey: 1 })).toEqual({ arbitrary_key: 1 });
  });

  it("translates a numeric RequirementTerm.state to its PascalCase variant", () => {
    expect(
      convertTerm({
        kind: "requirement",
        value: { requirementId: "01900000-0000-0000-0000-000000000abc", state: 0 },
      }),
    ).toEqual({
      Requirement: {
        time_requirement: "01900000-0000-0000-0000-000000000abc",
        state: "Met",
      },
    });
  });

  it("translates a numeric RelationTerm.windowKind to its PascalCase variant", () => {
    expect(
      convertTerm({
        kind: "relation",
        value: {
          referenceId: "01900000-0000-0000-0000-000000000def",
          relation: 0,
          windowKind: 2,
        },
      }),
    ).toEqual({
      Relation: {
        reference_id: "01900000-0000-0000-0000-000000000def",
        relation: 0,
        window_kind: "ParentSpan",
      },
    });
  });

  it("leaves an already-string state alone (does not double-translate)", () => {
    expect(
      convertTerm({ kind: "task", value: { taskId: "t1", state: "Completed" } }),
    ).toEqual({
      Task: { task_id: "t1", state: "Completed" },
    });
  });
});

describe("convertCondition (internally-tagged → externally-tagged wire form)", () => {
  it("converts ConditionNode::All recursively", () => {
    expect(
      convertCondition({
        kind: 0,
        children: [
          {
            kind: 3,
            children: [],
            term: { kind: "task", value: { taskId: "task_default", state: 2 } },
          },
        ],
        term: null,
      }),
    ).toEqual({
      All: [
        {
          Term: { Task: { task_id: "task_default", state: "Completed" } },
        },
      ],
    });
  });

  it("converts ConditionNode::Any", () => {
    expect(
      convertCondition({
        kind: 1,
        children: [
          {
            kind: 3,
            children: [],
            term: { kind: "calendar", value: { weekdayMask: 0 } },
          },
        ],
        term: null,
      }),
    ).toEqual({
      Any: [
        {
          Term: { Calendar: { weekday_mask: 0 } },
        },
      ],
    });
  });

  it("converts ConditionNode::Not with a single child", () => {
    expect(
      convertCondition({
        kind: 2,
        children: [
          {
            kind: 3,
            children: [],
            term: { kind: "task", value: { taskId: "t1", state: 1 } },
          },
        ],
        term: null,
      }),
    ).toEqual({
      Not: { Term: { Task: { task_id: "t1", state: "Marked" } } },
    });
  });

  it("converts a nested All(Any(Not(Term))) tree", () => {
    expect(
      convertCondition({
        kind: 0, // ALL
        children: [
          {
            kind: 1, // ANY
            children: [
              {
                kind: 2, // NOT
                children: [
                  {
                    kind: 3, // TERM
                    children: [],
                    term: { kind: "task", value: { taskId: "t1", state: 2 } },
                  },
                ],
                term: null,
              },
            ],
            term: null,
          },
        ],
        term: null,
      }),
    ).toEqual({
      All: [
        {
          Any: [
            {
              Not: {
                Term: { Task: { task_id: "t1", state: "Completed" } },
              },
            },
          ],
        },
      ],
    });
  });

  it("converts an empty All node (matches Rust Condition::any(Vec::new()))", () => {
    expect(
      convertCondition({ kind: 0, children: [], term: null }),
    ).toEqual({ All: [] });
  });

  it("passes through null and non-object values", () => {
    expect(convertCondition(null)).toBe(null);
    expect(convertCondition(undefined)).toBe(undefined);
  });
});

describe("toWireSetPlanBody (full plan rewrite)", () => {
  it("converts authored conditions inside planning rules and decisions", () => {
    const condition = {
      kind: 3 as const,
      children: [],
      term: {
        kind: "calendar" as const,
        value: {
          weekdayMask: 0b0101010,
          timeStart: null,
          timeEnd: null,
          holidayKind: 2 as const,
          dateRange: null,
          offsetMin: 0,
        },
      },
    };
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [],
        tasks: [],
      },
      planning: {
        placementRules: [{ id: "rule", when: condition, rank: 2, effect: {} }],
        nestingRules: [],
        flows: [],
      },
      metrics: [],
      decisions: [
        {
          id: "decision",
          observe: { scope: 0 },
          candidates: [
            {
              id: "c1",
              when: condition,
              rank: 0,
              effects: [],
            },
          ],
          reuse: [],
          dialog: null,
        },
      ],
    };

    const wire = toWireSetPlanBody(storePlan);

    expect(wire.planning.placement_rules[0]).toMatchObject({
      when: { Term: { Calendar: { weekday_mask: 0b0101010 } } },
    });
    expect((wire.decisions[0] as Record<string, unknown>).candidates).toEqual([
      {
        id: "c1",
        when: {
          Term: {
            Calendar: {
              weekday_mask: 42,
              time_start: null,
              time_end: null,
              holiday_kind: 2,
              date_range: null,
              offset_min: 0,
            },
          },
        },
        rank: 0,
        effects: [],
      },
    ]);
  });

  it("converts the default QuickCreate plan to wire format", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: {
          kind: 0,
          children: [
            {
              kind: 3,
              children: [],
              term: { kind: "task", value: { taskId: TASK_DEFAULT_ID, state: 2 } },
            },
          ],
          term: null,
        },
        timeRequirements: [
          {
            id: TIME_REQ_ID,
            observation: {
              scope: 1,
              source: 0,
              aggregate: 0,
              quantifier: 0,
            },
            required: { minMs: 30 * 60_000, maxMs: 90 * 60_000 },
            preferred: null,
          },
        ],
        tasks: [
          {
            id: TASK_DEFAULT_ID,
            content: { title: "Work complete", note: null },
            show: null,
            complete: {
              kind: 3,
              children: [],
              term: { kind: "task", value: { taskId: TASK_DEFAULT_ID, state: 2 } },
            },
            order: [],
          },
        ],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    expect(toWireSetPlanBody(storePlan)).toEqual({
      role: 0,
      references: [],
      completion: {
        root: {
          All: [
            {
              Term: { Task: { task_id: TASK_DEFAULT_ID, state: "Completed" } },
            },
          ],
        },
        time_requirements: [
          {
            id: TIME_REQ_ID,
            observation: {
              scope: 1,
              source: 0,
              aggregate: 0,
              quantifier: 0,
              reference: null,
            },
            required: {
              min: 30 * 60_000,
              max: 90 * 60_000,
            },
            preferred: null,
          },
        ],
        tasks: [
          {
            id: TASK_DEFAULT_ID,
            content: { title: "Work complete", description: null },
            show: null,
            complete: {
              Term: { Task: { task_id: TASK_DEFAULT_ID, state: "Completed" } },
            },
            order: [],
          },
        ],
      },
      planning: { placement_rules: [], nesting_rules: [] },
      metrics: [],
      decisions: [],
    });
  });

  it("preserves `reference` on TimeObservation when set", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [
          {
            id: "tr_ref",
            observation: {
              scope: 4,
              source: 0,
              aggregate: 0,
              quantifier: null,
              reference: "ref-xyz",
            },
            required: { minMs: null, maxMs: null },
            preferred: null,
          },
        ],
        tasks: [],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    expect(wire.completion.time_requirements[0].observation).toEqual({
      scope: 4,
      source: 0,
      aggregate: 0,
      quantifier: null,
      reference: "ref-xyz",
    });
    expect(wire.completion.time_requirements[0].required).toEqual({
      min: null,
      max: null,
    });
  });

  it("recurses into ReferenceDef.when", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [
        {
          id: REF_ID,
          target: { kind: 0 },
          pick: { kind: 0, at: null },
          when: {
            kind: 3,
            children: [],
            term: { kind: "task", value: { taskId: TASK_DEFAULT_ID, state: 2 } },
          },
        },
      ],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [],
        tasks: [],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    expect(wire.references).toEqual([
      {
        id: REF_ID,
        target: 0,
        pick: { kind: 0, at: null },
        when: { Term: { Task: { task_id: TASK_DEFAULT_ID, state: "Completed" } } },
      },
    ]);
  });
});

describe("toWireSetPlanBody (id normalisation)", () => {
  // v1/10 §1: every aggregate id is a UUIDv7. The QuickCreate store
  // seeds convenient placeholders ("task_default", `tr_<random>`) so the
  // editing surface stays readable. The wire boundary MUST regenerate
  // any non-UUIDv7 id before sending; otherwise the server returns 422.
  // Internal references inside condition trees (TaskTerm.taskId,
  // TaskOrderRelation.targetTaskId, RelationTerm.referenceId) MUST be
  // rewritten in lockstep so the body stays self-consistent.

  const UUIDV7_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("regenerates a non-UUIDv7 Task id and rewrites TaskTerm.taskId references", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: {
          kind: 0,
          children: [
            {
              kind: 3,
              children: [],
              term: { kind: "task", value: { taskId: "task_default", state: 2 } },
            },
          ],
          term: null,
        },
        timeRequirements: [],
        tasks: [
          {
            id: "task_default",
            content: { title: "Work complete", note: null },
            show: null,
            complete: {
              kind: 3,
              children: [],
              term: { kind: "task", value: { taskId: "task_default", state: 2 } },
            },
            order: [],
          },
        ],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    const taskId = wire.completion.tasks[0].id;
    // Server-acceptable shape
    expect(taskId).toMatch(UUIDV7_RE);
    expect(wire.completion.root).toEqual({
      All: [{ Term: { Task: { task_id: taskId, state: "Completed" } } }],
    });
    expect(wire.completion.tasks[0].complete).toEqual({
      Term: { Task: { task_id: taskId, state: "Completed" } },
    });
  });

  it("regenerates a non-UUIDv7 TimeRequirement id and leaves sibling ids alone", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [
          { id: "tr_abc", observation: { scope: 1, source: 0, aggregate: 0, quantifier: 0 }, required: { minMs: 1000, maxMs: 2000 }, preferred: null },
          { id: TIME_REQ_ID, observation: { scope: 1, source: 0, aggregate: 0, quantifier: 0 }, required: { minMs: 1000, maxMs: 2000 }, preferred: null },
        ],
        tasks: [],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    expect(wire.completion.time_requirements[0].id).toMatch(UUIDV7_RE);
    expect(wire.completion.time_requirements[0].id).not.toBe("tr_abc");
    // Already-UUIDv7 stays unchanged
    expect(wire.completion.time_requirements[1].id).toBe(TIME_REQ_ID);
  });

  it("regenerates a non-UUIDv7 ReferenceDef id and rewrites RelationTerm.referenceId", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [
        {
          id: "ref_legacy",
          target: { kind: 0 },
          pick: { kind: 0, at: null },
          when: {
            kind: 3,
            children: [],
            term: {
              kind: "relation",
              value: { referenceId: "ref_legacy", relation: 0, windowKind: 0 },
            },
          },
        },
      ],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [],
        tasks: [],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    const refDef = wire.references[0] as { id: string; when: unknown };
    const refId = refDef.id;
    expect(refId).toMatch(UUIDV7_RE);
    expect(refId).not.toBe("ref_legacy");
    expect(refDef.when).toEqual({
      Term: { Relation: { reference_id: refId, relation: 0, window_kind: "Root" } },
    });
  });

  it("rewrites TaskOrderRelation.targetTaskId against the regenerated task id", () => {
    const storePlan: StorePlanInput = {
      role: 0,
      references: [],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [],
        tasks: [
          {
            id: "task_a",
            content: { title: "A", note: null },
            show: null,
            complete: { kind: 3, children: [], term: { kind: "task", value: { taskId: "task_a", state: 2 } } },
            order: [
              {
                id: "order_a_b",
                targetTaskId: "task_a",
                relation: 0,
                when: null,
              },
            ],
          },
        ],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    };

    const wire = toWireSetPlanBody(storePlan);
    const taskId = wire.completion.tasks[0].id;
    expect(taskId).toMatch(UUIDV7_RE);
    expect(wire.completion.tasks[0].order[0].id).toMatch(UUIDV7_RE);
    expect(wire.completion.tasks[0].order[0].target_task_id).toBe(taskId);
    expect(wire.completion.tasks[0].order[0].relation).toBe(0);
    expect(wire.completion.tasks[0]).not.toHaveProperty("children");
    expect(wire.completion.tasks[0].complete).toEqual({
      Term: { Task: { task_id: taskId, state: "Completed" } },
    });
  });
});
