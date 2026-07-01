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
async function deleteV1(page: Page, path: string, body: unknown) {
  return page.request.delete(`${V1_BASE}${path}`, { headers: auth, data: body });
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

test.describe("v1 - Archive / Proposal removal (AT-022)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-022 archiving the parent recurring tile keeps the materialized placement body intact", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-022 archive " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Snapshot the placement body before archive.
    const beforeTile = (await (await getV1(page, "/v1/tiles")).json()) as Array<{ id: string; archived?: boolean }>;
    const beforeArchived = beforeTile.find((t) => t.id === recurringId)?.archived;
    expect(beforeArchived).toBeFalsy();

    // Find the underlying v1_tile UUID for the recurring (not v1_recurring).
    const tileId = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT tile_id FROM v1_recurring WHERE id = '${recurringId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(tileId.length).toBeGreaterThan(0);

    // Archive the parent tile.
    const arch = await deleteV1(page, `/v1/tiles/${tileId}`, {
      idempotency_key: uuidv7like(),
      payload: { tile_id: tileId },
    });
    expect(arch.status(), `archive status: ${arch.status()}`).toBeLessThan(300);

    // The placement body row MUST still exist (no silent delete).
    const placementCount = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT count(*) FROM v1_placement WHERE id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(placementCount).toBe("1");

    // And /v1/tiles no longer lists the archived recurring tile.
    const afterTile = (await (await getV1(page, "/v1/tiles")).json()) as Array<{ id: string }>;
    expect(afterTile.find((t) => t.id === recurringId)).toBeUndefined();
  });
});
