import { test, expect, type Page } from "@playwright/test";
import { v1AuthHeaders } from "./helpers/v1";
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

const auth = v1AuthHeaders();
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

test.describe("v1 - Read API (AT-060 / AT-061 / AT-062)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-060 /v1/timeline returns the effective placement span resolved by the server", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-060 daily " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T11:00:00.000Z`);
    const placementId = await placementIdForRecurring(page, recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    const status = await appendChangeSet(page, placementId, 0, `${day}T09:30:00.000Z`);
    expect(status, `append changes status: ${status}`).toBeLessThan(300);

    const timeline = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    expect(timeline.status()).toBe(200);
    const items = (await timeline.json()) as Array<{
      placement_id: string;
      span: { start: string; end: string };
      resolution: { state: number; violations: Array<{ kind: number }> };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found, "placement should appear in /v1/timeline").toBeTruthy();
    expect(found!.span.start).toBe(`${day}T09:30:00Z`);
    expect(found!.span.end).toBe(`${day}T11:00:00Z`);
    expect(found!.resolution.state).toBe(0);
  });

  test("AT-061 BLOCKED placement is returned with violations when include_blocked=true", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-061 invalid " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(page, recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Force SpanInvalid by setting span_start to 11:00 (after baseline 10:00 end).
    const status = await appendChangeSet(page, placementId, 0, `${day}T11:00:00.000Z`);
    expect(status, `append changes status: ${status}`).toBeLessThan(300);

    const filtered = await getV1(page, `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z`);
    expect(filtered.status()).toBe(200);
    const filteredItems = (await filtered.json()) as Array<{ placement_id: string }>;
    expect(filteredItems.find((i) => i.placement_id === placementId)).toBeFalsy();

    const all = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    expect(all.status()).toBe(200);
    const allItems = (await all.json()) as Array<{
      placement_id: string;
      resolution: { state: number; violations: Array<{ kind: number }> };
    }>;
    const found = allItems.find((i) => i.placement_id === placementId);
    expect(found, "BLOCKED placement should be returned with include_blocked=true").toBeTruthy();
    expect(found!.resolution.state).toBe(2);
    expect(found!.resolution.violations.find((v) => v.kind === 0)).toBeTruthy();
  });

  test("AT-062 GET /v1/executions/{id}/basis returns the values captured at StartExecution", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-062 exec " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(page, recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    const start = await postV1(page, `/v1/placements/${placementId}/executions`, {
      idempotency_key: uuidv7like(),
      payload: { placement_id: placementId },
    });
    expect(start.status(), `POST start_execution: ${start.status()}`).toBeLessThan(300);
    const executionId = ((await start.json()) as { aggregate: { id: string } }).aggregate.id;

    const basis = await getV1(page, `/v1/executions/${executionId}/basis`);
    expect(basis.status()).toBe(200);
    const basisBody = (await basis.json()) as {
      execution_id: string;
      placement_id: string;
      placement_revision: number;
      captured_at: string;
    };
    expect(basisBody.execution_id).toBe(executionId);
    expect(basisBody.placement_id).toBe(placementId);
    expect(typeof basisBody.placement_revision).toBe("number");
    expect(new Date(basisBody.captured_at).getTime()).not.toBeNaN();

    const view = await getV1(page, `/v1/executions/${executionId}`);
    expect(view.status()).toBe(200);
    const body = (await view.json()) as { id: string; state: number; placement_id: string; captured_at: string | null };
    expect(body.id).toBe(executionId);
    expect(body.state).toBe(0);
    expect(body.placement_id).toBe(placementId);
    expect(body.captured_at).not.toBeNull();
  });
});
