import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const V1_BASE = "http://127.0.0.1:31400";
function uuidv7like(): string {
  const h = (n: number) => Math.floor(Math.random() * Math.pow(16, n)).toString(16).padStart(n, "0");
  return h(8) + "-" + h(4) + "-" + h(4) + "-" + h(4) + "-" + h(12);
}
async function cleanDb() {
  execFileSync("docker", ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c", "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile CASCADE;"], { stdio: "ignore" });
}
test("debug at011", async ({ page }) => {
  await cleanDb();
  // create recurring
  const c = await page.request.post(V1_BASE + "/v1/tiles", {
    headers: { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR },
    data: { idempotency_key: uuidv7like(), payload: { kind: 0, title: "Debug " + Date.now(), description: null, color: "#0ea5e9", icon: "check", external_id: null, plan_role: 0 } },
  });
  const cj = await c.json() as { aggregate: { id: string } };
  const recurringId = cj.aggregate.id;
  // frame rule
  const fr = await page.request.post(V1_BASE + "/v1/recurring/" + recurringId + "/frame-rules", {
    headers: { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR },
    data: { idempotency_key: uuidv7like(), payload: { recurring_id: recurringId, rule: { id: uuidv7like(), active: null, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } } } },
  });
  console.log("frame_rule status=" + fr.status());
  const fruid = execFileSync("docker", ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c", "SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '" + recurringId + "' LIMIT 1;"], { encoding: "utf8" }).trim();
  // materialize
  const m = await page.request.post(V1_BASE + "/v1/recurring/" + recurringId + "/frame-rules/" + fruid + "/materialize", {
    headers: { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR },
    data: { idempotency_key: uuidv7like(), payload: { recurring_id: recurringId, frame_rule_id: fruid, range_start: "2026-07-01T09:00:00.000Z", range_end: "2026-07-01T10:00:00.000Z" } },
  });
  console.log("materialize status=" + m.status());
  const placementId = execFileSync("docker", ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c", "SELECT s.placement_id FROM v1_placement_source_ref_recurring s WHERE s.recurring_tile = '" + recurringId + "' LIMIT 1;"], { encoding: "utf8" }).trim();
  console.log("placementId=" + placementId);
  // append ChangeSet
  const cs = await page.request.post(V1_BASE + "/v1/placements/" + placementId + "/changes", {
    headers: { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR },
    data: {
      idempotency_key: uuidv7like(),
      payload: {
        target: { Placement: placementId },
        layer: 1,
        rank: 0,
        changes: [{ key: { group: 5, item: null, part: 0 }, kind: 2, value: { Instant: "2026-07-01T09:30:00.000Z" }, merge: 0, source: 2, source_ref: null, rank: 0 }],
        activation: { when: null, until: null },
        revoked: null,
        source: 2,
        source_ref: null,
        created_at: "2026-07-01T00:00:00Z",
        created_by: { at: "2026-07-01T00:00:00Z", actor: ACTOR, actor_kind: 0, command_id: uuidv7like() },
      },
    },
  });
  console.log("change status=" + cs.status());
  const text = await cs.text();
  console.log("change body=" + text);
});
