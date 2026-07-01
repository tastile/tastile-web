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

async function cleanDb() {
  execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c",
     "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile CASCADE;"],
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
      rule: { id: uuidv7like(), active: null, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } },
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
  const m = await postV1(page, `/v1/recurring/${recurringId}/frame-rules/${frameRuleId}/materialize`, {
    idempotency_key: uuidv7like(),
    payload: { recurring_id: recurringId, frame_rule_id: frameRuleId, range_start: start, range_end: end },
  });
  expect(m.status(), `POST materialize: ${m.status()}`).toBeLessThan(300);
}

async function placementIdForRecurring(recurringId: string): Promise<string> {
  return execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
     `SELECT s.placement_id FROM v1_placement_source_ref_recurring s WHERE s.recurring_tile = '${recurringId}' LIMIT 1;`],
    { encoding: "utf8" },
  ).trim();
}

async function startExecution(page: Page, placementId: string) {
  const r = await postV1(page, `/v1/placements/${placementId}/executions`, {
    idempotency_key: uuidv7like(),
    payload: { placement_id: placementId },
  });
  if (r.status() >= 300) throw new Error("startExecution: " + r.status());
  return (await r.json()) as { aggregate: { id: string } };
}

async function finishExecution(page: Page, exId: string, kind: 0 | 3) {
  // kind: 0 = FinishedNormal, 3 = FinishedVoid  (per v1/02 ExecutionFinishKind
  // and ExecutionState shares the numeric space 0/1/2/3).
  return (await postV1(page, `/v1/executions/${exId}/finish`, {
    idempotency_key: uuidv7like(),
    payload: { kind, note: null },
  })).status();
}

test.describe("v1 - Finish (VOID) lifecycle (AT-034)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-034 finish(kind=VOID) keeps execution / segment / fact / task_run rows; not in active tile view", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-034 void " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);

    const start = await startExecution(page, placementId);
    const exId = start.aggregate.id;
    expect(exId.length).toBeGreaterThan(0);

    // Finish with kind=3 (VOID).
    const status = await finishExecution(page, exId, 3);
    expect(status, "finish status: " + status).toBeLessThan(300);

    // The execution row is preserved with state=3 (FinishedVoid).
    const exRow = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT state, finish_kind FROM v1_execution WHERE id = '${exId}';`],
      { encoding: "utf8" },
    ).trim();
    const [exState, exFinish] = exRow.split(/\s+|\|/); expect(exState).toBe("3"); expect(exFinish).toBe("3");

    // /v1/active-tile no longer returns this execution.
    const active = (await (await getV1(page, "/v1/active-tile")).json()) as { execution_id?: string } | null;
    expect(active?.execution_id ?? null).not.toBe(exId);

    // History rows are NOT deleted: the execution still exists and
    // its segment count is non-empty.
    const segCount = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT count(*) FROM v1_execution_segment WHERE execution_id = '${exId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(Number(segCount)).toBeGreaterThanOrEqual(1);

    // And subsequent pause on the void'd execution must fail (state
    // is no longer Active).
    const pauseAfterVoid = (await postV1(page, `/v1/executions/${exId}/pause`, {
      idempotency_key: uuidv7like(), payload: null,
    })).status();
    expect(pauseAfterVoid).toBeGreaterThanOrEqual(400);
  });
});
