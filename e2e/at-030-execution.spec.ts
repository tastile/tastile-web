import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const V1_BASE = "http://127.0.0.1:31400";

function uuidv7like(): string {
  const h = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n)).toString(16).padStart(n, "0");
  return `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`;
}

async function cleanDb(): Promise<void> {
  execFileSync(
    "docker",
    [
      "exec", "-i", "tastile-core-db-1", "psql",
      "-U", "tastile", "-d", "tastile_db",
      "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

const auth = { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR };
async function postV1(page: Page, path: string, body: unknown) {
  return page.request.post(`${V1_BASE}${path}`, { headers: auth, data: body });
}
async function getV1(page: Page, path: string) {
  return page.request.get(`${V1_BASE}${path}`, { headers: auth });
}

async function createRecurring(page: Page, title: string) {
  const c = await postV1(page, "/v1/tiles", {
    idempotency_key: uuidv7like(),
    payload: { kind: 0, title, description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 },
  });
  expect(c.status(), `POST /v1/tiles status: ${c.status()}`).toBeLessThan(300);
  return (await c.json()) as { aggregate: { id: string } };
}

async function addStepFrameRule(page: Page, recurringId: string) {
  const r = await postV1(page, `/v1/recurring/${recurringId}/frame-rules`, {
    idempotency_key: uuidv7like(),
    payload: {
      recurring_id: recurringId,
      rule: {
        id: uuidv7like(),
        active: null,
        rank: 0,
        generator: { Step: { step: 86_400_000, origin: null, bounds: null } },
      },
    },
  });
  expect(r.status(), `POST frame-rules: ${r.status()}`).toBeLessThan(300);
  return execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
     `SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}' LIMIT 1;`],
    { encoding: "utf8" },
  ).trim();
}

async function materialize(page: Page, recurringId: string, frameRuleId: string, start: string, end: string) {
  const m = await postV1(
    page,
    `/v1/recurring/${recurringId}/frame-rules/${frameRuleId}/materialize`,
    {
      idempotency_key: uuidv7like(),
      payload: { recurring_id: recurringId, frame_rule_id: frameRuleId, range_start: start, range_end: end },
    },
  );
  expect(m.status(), `POST materialize: ${m.status()}`).toBeLessThan(300);
}

async function placementIdForRecurring(page: Page, recurringId: string): Promise<string> {
  const id = execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
     `SELECT s.placement_id FROM v1_placement_source_ref_recurring s WHERE s.recurring_tile = '${recurringId}' LIMIT 1;`],
    { encoding: "utf8" },
  ).trim();
  return id;
}

// Append a Placement-layer ChangeSet that sets span_start or span_end.
// kind: 2 = Put, layer: 1 = Placement, source: 2 = User
async function appendChangeSet(page: Page, placementId: string, slot: 0 | 1, instant: string) {
  const cs = await postV1(page, `/v1/placements/${placementId}/changes`, {
    idempotency_key: uuidv7like(),
    payload: {
      placement_id: placementId,
      changeset: {
        id: uuidv7like(),
        owner_id: OWNER,
        target: { Placement: placementId },
        layer: 1,
        rank: 0,
        changes: [
          {
            id: uuidv7like(),
            key: { group: 5, item: null, part: slot },
            kind: 2,
            value: { Instant: instant },
            merge: 0,
            source: 2,
            source_ref: null,
            rank: 0,
          },
        ],
        activation: { when: null, until: null },
        revoked: null,
        source: 2,
        source_ref: null,
        created_at: "2026-07-01T00:00:00Z",
        created_by: { at: "2026-07-01T00:00:00Z", actor: ACTOR, actor_kind: 0, command_id: uuidv7like() },
      },
    },
  });
  return cs.status();
}

async function startExecution(page: Page, placementId: string) {
  const r = await postV1(page, "/v1/placements/"+placementId+"/executions", {
    idempotency_key: uuidv7like(),
    payload: { placement_id: placementId },
  });
  if (r.status() >= 300) throw new Error("startExecution: "+r.status());
  return await r.json();
}
async function pauseExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/pause", {
    idempotency_key: uuidv7like(), payload: null,
  })).status();
}
async function resumeExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/resume", {
    idempotency_key: uuidv7like(), payload: null,
  })).status();
}
async function finishExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/finish", {
    idempotency_key: uuidv7like(),
    payload: { kind: 0, note: null },
  })).status();
}

test.describe("v1 - Execution (AT-030 / AT-031 / AT-032 / AT-033 / AT-035)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-030 start_execution returns execution; GET /v1/executions/{id} shows state=Active, captured_at set, placement_id matches", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-030 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, day+"T09:00:00.000Z", day+"T10:00:00.000Z");
    const placementId = await placementIdForRecurring(page, recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    const start = await startExecution(page, placementId);
    expect(start.aggregate.id.length).toBeGreaterThan(0);

    const view = await getV1(page, "/v1/executions/"+start.aggregate.id);
    expect(view.status()).toBe(200);
    const body = (await view.json()) as {
      id: string; state: number; placement_id: string;
      captured_at: string | null; open_segment_kind: number | null; segment_count: number;
    };
    expect(body.id).toBe(start.aggregate.id);
    expect(body.state).toBe(0);
    expect(body.placement_id).toBe(placementId);
    expect(body.captured_at).not.toBeNull();
    expect(body.open_segment_kind).toBe(0);
    expect(body.segment_count).toBe(1);
  });

  test("AT-031 StartExecution captures placement_revision; later ChangeSet does not change basis.placement_revision", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-031 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, day+"T09:00:00.000Z", day+"T10:00:00.000Z");
    const placementId = await placementIdForRecurring(page, recurringId);

    const start = await startExecution(page, placementId);
    const basis1 = (await (await getV1(page, "/v1/executions/"+start.aggregate.id+"/basis")).json()) as {
      placement_revision: number; placement_id: string;
    };
    const originalRev = basis1.placement_revision;
    expect(basis1.placement_id).toBe(placementId);

    const cs = await appendChangeSet(page, placementId, 0, day+"T09:30:00.000Z");
    expect(cs).toBeLessThan(300);

    const basis2 = (await (await getV1(page, "/v1/executions/"+start.aggregate.id+"/basis")).json()) as {
      placement_revision: number; placement_id: string;
    };
    expect(basis2.placement_revision).toBe(originalRev);
    expect(basis2.placement_id).toBe(placementId);

    const cur = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT revision FROM v1_placement WHERE id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(Number(cur)).toBeGreaterThan(originalRev);
  });

  test("AT-032 two StartExecution calls on the same placement return the same execution_id (idempotent)", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-032 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, day+"T09:00:00.000Z", day+"T10:00:00.000Z");
    const placementId = await placementIdForRecurring(page, recurringId);

    const a = await startExecution(page, placementId);
    const b = await startExecution(page, placementId);
    expect(a.aggregate.id).toBe(b.aggregate.id);

    const cnt = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT count(*) FROM v1_execution e JOIN v1_execution_basis b ON b.execution_id = e.id WHERE b.placement_id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(cnt).toBe("1");
  });

  test("AT-033 start -> pause -> resume toggles state and open_segment_kind; segment_count grows", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-033 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, day+"T09:00:00.000Z", day+"T10:00:00.000Z");
    const placementId = await placementIdForRecurring(page, recurringId);

    const start = await startExecution(page, placementId);
    const exId = start.aggregate.id;

    expect(await pauseExecution(page, exId)).toBeLessThan(300);
    const paused = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; open_segment_kind: number | null; segment_count: number;
    };
    expect(paused.state).toBe(1);
    expect(paused.open_segment_kind).toBe(1);
    expect(paused.segment_count).toBe(2);

    expect(await resumeExecution(page, exId)).toBeLessThan(300);
    const resumed = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; open_segment_kind: number | null; segment_count: number;
    };
    expect(resumed.state).toBe(0);
    expect(resumed.open_segment_kind).toBe(0);
    expect(resumed.segment_count).toBe(3);
  });

  test("AT-035 start -> finish(kind=Normal) closes the execution; placement span in /v1/timeline is unchanged", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-035 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, day+"T09:00:00.000Z", day+"T10:00:00.000Z");
    const placementId = await placementIdForRecurring(page, recurringId);

    const start = await startExecution(page, placementId);
    const exId = start.aggregate.id;

    expect(await finishExecution(page, exId)).toBeLessThan(300);

    const after = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; finished_at: string | null; finish_kind: number | null;
    };
    expect(after.state).toBe(2);
    expect(after.finished_at).not.toBeNull();
    expect(after.finish_kind).toBe(0);

    expect(await pauseExecution(page, exId)).toBeGreaterThanOrEqual(400);

    const tl = await getV1(page, "/v1/timeline?start="+day+"T00:00:00Z&end="+day+"T23:59:59Z");
    const items = (await tl.json()) as Array<{ placement_id: string; span: { start: string; end: string } }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    expect(found!.span.start).toBe(day+"T09:00:00Z");
    expect(found!.span.end).toBe(day+"T10:00:00Z");
  });

});
