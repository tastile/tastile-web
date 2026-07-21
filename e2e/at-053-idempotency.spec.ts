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
async function getV1(page: Page, path: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
  return page.request.get(`${V1_BASE}${path}`, { headers: auth });
}

async function createRecurring(page: Page, title: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const c = await postV1(page, "/v1/tiles", {
    idempotency_key: uuidv7like(),
    payload: { kind: 0, title, description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 },
  });
  expect(c.status(), `POST /v1/tiles status: ${c.status()}`).toBeLessThan(300);
  return (await c.json()) as { aggregate: { id: string } };
}

async function addStepFrameRule(page: Page, recurringId: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
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

async function materialize(page: Page, recurringId: string, frameRuleId: string, start: string, end: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
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

async function placementIdForRecurring(page: Page, recurringId: string): Promise<string> { // eslint-disable-line @typescript-eslint/no-unused-vars
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
async function appendChangeSet(page: Page, placementId: string, slot: 0 | 1, instant: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
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


test.describe("v1 - Idempotency (AT-053 / AT-054)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-053 same idempotency_key + same payload replays the same command_id / aggregate.id / revision; only one row stored", async ({ page }) => {
    const key = uuidv7like();
    const title = "AT-053 idempotent tile " + Date.now();
    const payload = { kind: 0, title, description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 };

    const r1 = await postV1(page, "/v1/tiles", { idempotency_key: key, payload });
    expect(r1.status(), "first POST status: "+r1.status()).toBeLessThan(300);
    const j1 = (await r1.json()) as { command_id: string; aggregate: { id: string }; revision: number };
    expect(j1.command_id.length).toBeGreaterThan(0);
    expect(j1.aggregate.id.length).toBeGreaterThan(0);

    const r2 = await postV1(page, "/v1/tiles", { idempotency_key: key, payload });
    expect(r2.status(), "second POST status: "+r2.status()).toBeLessThan(300);
    const j2 = (await r2.json()) as { command_id: string; aggregate: { id: string }; revision: number };

    // Server replays the stored response: identical command_id / aggregate.id / revision.
    expect(j2.command_id).toBe(j1.command_id);
    expect(j2.aggregate.id).toBe(j1.aggregate.id);
    expect(j2.revision).toBe(j1.revision);

    // Only one row in v1_idempotency for this key.
    const cnt = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT count(*) FROM v1_idempotency WHERE idempotency_key = '${key}';`],
      { encoding: "utf8" },
    ).trim();
    expect(cnt).toBe("1");

    // For kind=0 (Recurring) the aggregate.id is the recurring_id; verify
    // both the recurring row and its underlying tile row exist (one each).
    const rowCnt = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT (SELECT count(*) FROM v1_recurring WHERE id = '${j1.aggregate.id}') || ',' || (SELECT count(*) FROM v1_tile t JOIN v1_recurring r ON r.tile_id = t.id WHERE r.id = '${j1.aggregate.id}');`],
      { encoding: "utf8" },
    ).trim();
    expect(rowCnt).toBe("1,1");
  });

  test("AT-054 same idempotency_key + different payload returns 409 IDEMPOTENCY_KEY_REUSED", async ({ page }) => {
    const key = uuidv7like();
    const baseTitle = "AT-054 first " + Date.now();
    const r1 = await postV1(page, "/v1/tiles", {
      idempotency_key: key,
      payload: { kind: 0, title: baseTitle, description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 },
    });
    expect(r1.status(), "first POST status: "+r1.status()).toBeLessThan(300);

    const r2 = await postV1(page, "/v1/tiles", {
      idempotency_key: key,
      payload: { kind: 0, title: baseTitle + " (DIFFERENT)", description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 },
    });
    expect(r2.status(), "second POST status: "+r2.status()).toBe(409);
    const err = (await r2.json()) as { kind: number; message: string };
    // ApiErrorKind enum: 3 = IdempotencyKeyReused (per domain::ApiErrorKind).
    expect(err.kind).toBe(3);
    expect(err.message.toLowerCase()).toContain("idempotency");
  });

});