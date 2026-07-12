import { beforeEach, describe, expect, it, vi } from "vitest";

import { AggregateKind, ApiErrorKind } from "@/lib/domain/v1/constants";
import type { ApiClient } from "@/lib/api/v1/endpoints";
import {
  listReferenceCatalog,
  publishScheduleDefinition,
  ScheduleReferenceUsage,
  type PublishScheduleDefinitionPayload,
} from "./schedule-definition";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const client: ApiClient = { baseUrl: "https://api.example.com", getIdToken: async () => "token" };
const payload: PublishScheduleDefinitionPayload = {
  tile: { title: "競プロ", description: null, color: null, icon: null, external_id: null },
  plan: {
    role: 0,
    references: [],
    completion: { root: { Term: { Fact: { key: "ready", comparison: "Exists" } } }, time_requirements: [], tasks: [] },
    planning: { placement_rules: [], nesting_rules: [] },
    metrics: [],
    decisions: [],
  },
  reference_targets: [],
  windows: [{ kind: 0, bounds: { start: "2026-07-01T00:00:00Z", end: "2026-07-02T00:00:00Z" }, rules: [{ id: "018f0000-0000-7000-8000-000000000002", weekday_mask: null, time_start_min: null, time_end_min: null, holiday_kind: 2, date_range: null, offset_min: 0, label_placement: null, parent_placement: null, gap_left_condition_id: null, gap_right_condition_id: null, gap_size: null }] }],
  recurrence: null,
  flows: [{ observes: ["FactChanged"], when: null, candidates: [{ when: { Term: { Fact: { key: "ready", comparison: "Exists" } } }, rank: 0, outputs: [{ ProposeNewPlanPlacement: { span: { start: "2026-07-01T00:00:00Z", end: "2026-07-02T00:00:00Z" } } }] }] }],
};

describe("schedule definition API", () => {
  beforeEach(() => fetchMock.mockReset());

  it("sends the core serde payload unchanged under the v1 envelope", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({
        command_id: "cmd", accepted_at: "2026-07-01T00:00:00Z",
        aggregate: { kind: AggregateKind.RECURRING, id: "tile-id" },
        aggregate_meta: { plan_id: "plan-id", window_ids: ["window-id"], flow_ids: ["flow-id"] },
      }),
    });
    const result = await publishScheduleDefinition({ client, payload });
    expect(result).toEqual({ ok: true, tileId: "tile-id", planId: "plan-id", windowsIds: ["window-id"], flowIds: ["flow-id"] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/schedule-definitions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).payload).toEqual(payload);
  });

  it("does not call the API for a blank title", async () => {
    const result = await publishScheduleDefinition({ client, payload: { ...payload, tile: { ...payload.tile, title: " " } } });
    expect(result).toMatchObject({ ok: false, error: { kind: ApiErrorKind.VALIDATION } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the authenticated label-span catalog from the core route with usage=1 only", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    const result = await listReferenceCatalog(client, "owner", ScheduleReferenceUsage.LABEL_SPAN);
    expect(result).toEqual({ ok: true, data: [], status: 200 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/v1/schedule-reference-catalog?usage=1",
    );
  });

  it("returns server errors without weakening the API contract", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 422,
      json: async () => ({ kind: ApiErrorKind.VALIDATION, message: "invalid", current_revision: null, violations: [] }),
    });
    const result = await publishScheduleDefinition({ client, payload });
    expect(result).toMatchObject({ ok: false, error: { kind: ApiErrorKind.VALIDATION, message: "invalid" } });
  });
});
