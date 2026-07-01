import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const PROXY = "/api/proxy";

function uuidv7like(): string {
  var h = (n: number) => Math.floor(Math.random() * Math.pow(16, n)).toString(16).padStart(n, "0");
  return h(8) + "-" + h(4) + "-" + h(4) + "-" + h(4) + "-" + h(12);
}

function todayUtc() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function cleanDb() {
  execFileSync("docker", [
    "exec", "-i", "tastile-core-db-1",
    "psql", "-U", "tastile", "-d", "tastile_db", "-c",
    "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile CASCADE;",
  ], { stdio: "ignore" });
}

async function postV1(req: APIRequestContext, path: string, body: unknown) {
  return req.post(PROXY + path, {
    headers: { "content-type": "application/json", "x-owner-id": OWNER, "x-actor-id": ACTOR },
    data: body,
  });
}

test.describe("v1 - AT-021 materialize idempotency", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("re-materializing the same (recurring, frame-rule, range) does not duplicate placements", async ({ request }) => {
    var day = todayUtc();

    var createRes = await postV1(request, "/v1/tiles", {
      idempotency_key: uuidv7like(),
      payload: { kind: 0, title: "AT021", description: null, color: "#3b82f6", icon: "check", external_id: null, plan_role: 0 },
    });
    expect(createRes.status()).toBeLessThan(300);
    var recurringId = (await createRes.json()).aggregate.id;

    var ruleRes = await postV1(request, "/v1/recurring/" + recurringId + "/frame-rules", {
      idempotency_key: uuidv7like(),
      payload: {
        recurring_id: recurringId,
        rule: { id: uuidv7like(), active: null, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } },
      },
    });
    expect(ruleRes.status()).toBeLessThan(300);
    var fruid = execFileSync("docker", [
      "exec", "-i", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-At",
      "-c", "SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '" + recurringId + "' LIMIT 1;",
    ], { encoding: "utf8" }).trim();

    var matPayload = {
      idempotency_key: uuidv7like(),
      payload: { recurring_id: recurringId, frame_rule_id: fruid, range_start: day + "T09:00:00.000Z", range_end: day + "T10:00:00.000Z" },
    };
    var first = await postV1(request, "/v1/recurring/" + recurringId + "/frame-rules/" + fruid + "/materialize", matPayload);
    expect(first.status()).toBeLessThan(300);

    // second materialize with same (recurring, frame_rule, range)
    var matPayload2 = {
      idempotency_key: uuidv7like(),
      payload: { recurring_id: recurringId, frame_rule_id: fruid, range_start: day + "T09:00:00.000Z", range_end: day + "T10:00:00.000Z" },
    };
    var second = await postV1(request, "/v1/recurring/" + recurringId + "/frame-rules/" + fruid + "/materialize", matPayload2);
    expect(second.status()).toBeLessThan(300);

    var countRes = execFileSync("docker", [
      "exec", "-i", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-At",
      "-c", "SELECT COUNT(*) FROM v1_placement WHERE owner_id = '" + OWNER + "';",
    ], { encoding: "utf8" }).trim();
    expect(countRes, "duplicate materialization must not double-create the placement").toBe("1");
  });
});
