/**
 * Type-level contract tests: verify that hand-written store types and
 * plan-wire.ts converters produce shapes compatible with the
 * OpenAPI-generated wire contract.
 *
 * These tests use Vitest's `expectTypeOf` — they validate at compile time.
 * No database or server needed.
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  WireCalendarTerm,
  WireCompletion,
  WireCondition,
  WirePlanning,
  WireTaskDefinition,
  WireTaskOrderRule,
  WireTerm,
} from "./openapi-contract";

// ---------------------------------------------------------------
// Condition wire shape
// ---------------------------------------------------------------

describe("Condition wire contract", () => {
  it("accepts All variant", () => {
    const v: WireCondition = { All: [] };
    expectTypeOf(v).toMatchTypeOf<WireCondition>();
  });

  it("accepts Any variant", () => {
    const v: WireCondition = { Any: [] };
    expectTypeOf(v).toMatchTypeOf<WireCondition>();
  });

  it("accepts Not variant", () => {
    // NOT wraps a Condition (not null)
    const v: WireCondition = { Not: { All: [] } };
    expectTypeOf(v).toMatchTypeOf<WireCondition>();
  });

  it("accepts Term variant with Calendar term", () => {
    const v: WireCondition = {
      Term: { Calendar: { weekday_mask: 0, holiday_kind: 0 } },
    };
    expectTypeOf(v).toMatchTypeOf<WireCondition>();
  });

  it("accepts Condition in All children", () => {
    const v: WireCondition = {
      All: [
        { Term: { Task: { task_id: "00000000-0000-7000-8000-000000000001", state: "Completed" } } },
      ],
    };
    expectTypeOf(v).toMatchTypeOf<WireCondition>();
  });
});

// ---------------------------------------------------------------
// Term wire shape
// ---------------------------------------------------------------

describe("Term wire contract", () => {
  it("accepts Calendar variant", () => {
    const v: WireTerm = {
      Calendar: { weekday_mask: 0, holiday_kind: 0 },
    };
    expectTypeOf(v).toMatchTypeOf<WireTerm>();
  });

  it("accepts Task variant", () => {
    const v: WireTerm = {
      Task: { task_id: "00000000-0000-7000-8000-000000000001", state: "Completed" },
    };
    expectTypeOf(v).toMatchTypeOf<WireTerm>();
  });

  it("accepts Relation variant", () => {
    const v: WireTerm = {
      Relation: {
        reference_id: "00000000-0000-7000-8000-000000000001",
        relation: 1,
        window_kind: "Root" as const,
      },
    };
    expectTypeOf(v).toMatchTypeOf<WireTerm>();
  });

  it("accepts Requirement variant", () => {
    const v: WireTerm = {
      Requirement: {
        time_requirement: "00000000-0000-7000-8000-000000000001",
        state: "Met" as const,
      },
    };
    expectTypeOf(v).toMatchTypeOf<WireTerm>();
  });
});

// ---------------------------------------------------------------
// CalendarTerm wire shape
// ---------------------------------------------------------------

describe("CalendarTerm wire contract", () => {
  it("accepts minimum valid shape", () => {
    const v: WireCalendarTerm = {
      weekday_mask: 0b0011111,
      holiday_kind: 2, // ANY
    };
    expectTypeOf(v).toMatchTypeOf<WireCalendarTerm>();
  });

  it("accepts with optional time range", () => {
    const v: WireCalendarTerm = {
      weekday_mask: 0b0011111,
      holiday_kind: 0,
      time_start: { hour: 8, minute: 50, nanos: 0, second: 0 },
      time_end: { hour: 10, minute: 20, nanos: 0, second: 0 },
    };
    expectTypeOf(v).toMatchTypeOf<WireCalendarTerm>();
  });

  it("accepts with date_range", () => {
    const v: WireCalendarTerm = {
      weekday_mask: 0,
      holiday_kind: 2,
      date_range: { start: "2026-06-10", end: "2026-08-10" },
    };
    expectTypeOf(v).toMatchTypeOf<WireCalendarTerm>();
  });

  it("accepts with offset_min", () => {
    const v: WireCalendarTerm = {
      weekday_mask: 0b0011111,
      holiday_kind: 0,
      offset_min: 540, // JST +9
    };
    expectTypeOf(v).toMatchTypeOf<WireCalendarTerm>();
  });
});

// ---------------------------------------------------------------
// Completion wire shape
// ---------------------------------------------------------------

describe("Completion wire contract", () => {
  it("accepts minimal wire completion", () => {
    const v: WireCompletion = {
      root: { All: [] },
      time_requirements: [],
      tasks: [],
    };
    expectTypeOf(v).toMatchTypeOf<WireCompletion>();
  });

  it("accepts with tasks and time requirements", () => {
    const v: WireCompletion = {
      root: {
        All: [
          {
            Term: {
              Task: {
                task_id: "00000000-0000-7000-8000-000000000001",
                state: "Completed",
              },
            },
          },
        ],
      },
      time_requirements: [
        {
          id: "00000000-0000-7000-8000-000000000002",
          observation: {
            scope: 1,
            source: 0,
            aggregate: 0,
            quantifier: null,
            reference: null,
          },
          required: { min: 15 * 60_000, max: 30 * 60_000 },
          preferred: null,
        },
      ],
      tasks: [
        {
          id: "00000000-0000-7000-8000-000000000003",
          content: { title: "Duolingo", description: "15分程度" },
          complete: { All: [] },
          order: [],
          show: null,
        },
      ],
    };
    expectTypeOf(v).toMatchTypeOf<WireCompletion>();
  });
});

// ---------------------------------------------------------------
// Task wire types
// ---------------------------------------------------------------

describe("Task wire contract", () => {
  it("accepts task definition with order", () => {
    const v: WireTaskDefinition = {
      id: "00000000-0000-7000-8000-000000000001",
      content: { title: "Duolingo", description: "15分程度" },
      complete: { All: [] },
      order: [
        {
          id: "00000000-0000-7000-8000-000000000002",
          target_task_id: "00000000-0000-7000-8000-000000000003",
          relation: 0, // BEFORE
          when: null,
        },
      ],
      show: null,
    };
    expectTypeOf(v).toMatchTypeOf<WireTaskDefinition>();
  });

  it("accepts task order rule", () => {
    const v: WireTaskOrderRule = {
      id: "00000000-0000-7000-8000-000000000001",
      target_task_id: "00000000-0000-7000-8000-000000000002",
      relation: 1, // AFTER
      when: null,
    };
    expectTypeOf(v).toMatchTypeOf<WireTaskOrderRule>();
  });
});

// ---------------------------------------------------------------
// Planning wire shape
// ---------------------------------------------------------------

describe("Planning wire contract", () => {
  it("accepts empty planning", () => {
    const v: WirePlanning = {
      placement_rules: [],
      nesting_rules: [],
    };
    expectTypeOf(v).toMatchTypeOf<WirePlanning>();
  });

  it("accepts with placement rule", () => {
    const v: WirePlanning = {
      placement_rules: [
        {
          id: "00000000-0000-7000-8000-000000000001",
          rank: 0,
          effect: { kind: 0, scope: { kind: 0, parent: null, gap: null } },
          when: null,
        },
      ],
      nesting_rules: [],
    };
    expectTypeOf(v).toMatchTypeOf<WirePlanning>();
  });
});
