import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSourceTile,
  getSourceTile,
  listSourceTilePlacements,
  reflowSourceTile,
  type SourceTileCreatePayload,
  updateSourceTile,
} from "./source-tiles";

const client = {
  baseUrl: "https://core.example",
  getIdToken: vi.fn().mockResolvedValue("token"),
};

const range = { start: "2026-07-19T00:00:00Z", end: "2026-07-20T00:00:00Z" };
const wireId = "019f7655-35b5-7a98-9480-003855af3168";

afterEach(() => vi.restoreAllMocks());

const sourceDefinition: SourceTileCreatePayload = {
  tile: {
    title: "Breakfast",
    description: null,
    color: null,
    icon: null,
    external_id: null,
  },
  plan: {
    role: 0,
    references: [],
    completion: { root: { Any: [] }, time_requirements: [], tasks: [] },
    planning: { placement_rules: [], nesting_rules: [] },
    metrics: [],
    decisions: [],
  },
  flows: [],
  schedule: {
    required_duration_ms: 900000,
    generation: {
      kind: 1,
      at: null,
      starts_at: "2026-07-19T07:40:00Z",
      interval_ms: 86400000,
      ends_at: null,
      weekday_mask: null,
      date_range_start: null,
      date_range_end: null,
      excluded_dates: [],
    },
    window: { start_offset_ms: 0, end_offset_ms: 1200000 },
    split_policy: { kind: 0, min_segment_ms: null, max_segment_ms: null, max_segments: null },
    priority: 0,
  },
  horizon: range,
};

const nonEmptySourceDefinition: SourceTileCreatePayload = {
  ...sourceDefinition,
  plan: {
    role: 0,
    references: [{ id: wireId, target: 0, pick: { kind: 0, at: { Absolute: "2026-07-19T08:00:00Z" } }, when: { Term: { Fact: { key: "ready", comparison: "Exists" } } } }],
    completion: {
      root: { All: [{ Term: { Task: { task_id: wireId, state: "Completed" } } }] },
      time_requirements: [{ id: wireId, observation: { scope: 1, source: 0, aggregate: 0, quantifier: null, reference: null }, required: { min: 900000, max: null }, preferred: null }],
      tasks: [{ id: wireId, content: { title: "Open Discord", description: null }, show: null, complete: { Term: { Requirement: { time_requirement: wireId, state: "Met" } } }, order: [] }],
    },
    planning: {
      placement_rules: [{ id: wireId, when: null, rank: 0, effect: { kind: 0, scope: null, span: null, score: null, record: null } }],
      nesting_rules: [{ id: wireId, direction: 0, when: null, rank: 0, target: { id: wireId, target: 0, pick: { kind: 0, at: null } }, scope: { kind: 0, parent: null, gap: null } }],
    },
    metrics: [{ id: wireId, output: 0, expression: { Choose: { branches: [{ when: { Term: { Metric: { metric_id: wireId, comparison: { GreaterThan: 0 } } } }, then: { Literal: 1 } }], default: { Literal: 0 } } }, limit: { min: 0, max: 1 } }],
    decisions: [{
      id: wireId,
      observe: 0,
      when: null,
      candidates: [{ id: wireId, when: { Term: { Life: { target: { Placement: wireId }, state: "Active" } } }, rank: 0, effects: [{ kind: 0, proposal: null, change: null, request: null, idempotency_key: null }] }],
      reuse: [{
        id: wireId,
        when: { Any: [{ Term: { Fact: { key: "feedback", comparison: { Equal: "yes" } } } }] },
        source: "All",
        apply: [],
      }],
      dialog: { id: wireId, visible: null, view: { title: "Confirm", body: null }, inputs: [], children: [] },
    }],
  },
  flows: [{
    observes: ["PlacementCreated", "ExecutionFinished"],
    when: { Term: { Calendar: { weekday_mask: 1, time_start: null, time_end: null, holiday_kind: 2, date_range: null, offset_min: 540 } } },
    candidates: [{ when: { Term: { Gap: { scope: { kind: 0, parent: null, gap: null }, left_anchor: { when: { Any: [{ Term: { Fact: { key: "left", comparison: "Exists" } } }] }, pick: { kind: 0, at: null } }, right_anchor: { when: { Any: [{ Term: { Fact: { key: "right", comparison: "Exists" } } }] }, pick: { kind: 0, at: null } }, size: null } } }, rank: 1, outputs: [{ ProposeNewPlanPlacement: { span: range } }] }],
  }],
};

describe("SourceTile client", () => {
  it("serializes non-empty Core enums with their externally tagged wire shapes", () => {
    const wire = structuredClone(nonEmptySourceDefinition);

    expect(wire.plan.completion.root).toEqual({ All: [{ Term: { Task: { task_id: wireId, state: "Completed" } } }] });
    expect(wire.plan.metrics[0].expression).toEqual({ Choose: {
      branches: [{ when: { Term: { Metric: { metric_id: wireId, comparison: { GreaterThan: 0 } } } }, then: { Literal: 1 } }],
      default: { Literal: 0 },
    } });
    expect(wire.flows[0]).toEqual(expect.objectContaining({
      observes: ["PlacementCreated", "ExecutionFinished"],
      candidates: [expect.objectContaining({ outputs: [{ ProposeNewPlanPlacement: { span: range } }] })],
    }));
  });

  it("creates and updates through the canonical SourceTile commands", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      command_id: "command-1", accepted_at: "2026-07-19T00:00:00Z",
    }), { status: 200 }));

    await createSourceTile({ client, payload: sourceDefinition });
    await updateSourceTile({
      client,
      sourceTileId: "source-1",
      expectedRevision: 2,
      payload: sourceDefinition,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://core.example/v1/source-tiles",
      "https://core.example/v1/source-tiles/source-1",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual(["POST", "PUT"]);
    for (const [index, [, init]] of fetchMock.mock.calls.entries()) {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toMatchObject({
        expected_revision: index === 0 ? null : 2,
        idempotency_key: expect.any(String),
        occurred_at: expect.any(String),
        payload: sourceDefinition,
      });
      expect(body.payload).not.toHaveProperty("source_tile_id");
    }
  });

  it("uses source-specific read, reflow, and placement endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      source: { source_tile_id: "source-1" }, occurrences: [], placements: [],
    }), { status: 200 }));

    await getSourceTile(client, "source-1");
    await reflowSourceTile({ client, sourceTileId: "source-1", expectedRevision: 2, range });
    await listSourceTilePlacements(client, "source-1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://core.example/v1/source-tiles/source-1",
      "https://core.example/v1/source-tiles/source-1/reflow",
      "https://core.example/v1/source-tiles/source-1/placements",
    ]);
    expect(fetchMock.mock.calls.slice(1).map(([, init]) => (init as RequestInit).method)).toEqual(["POST", "GET"]);
  });
});
