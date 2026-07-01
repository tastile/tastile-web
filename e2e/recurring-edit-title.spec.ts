import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
// All v1 calls go through the Next.js v1 proxy.  Playwright's
// `request` fixture is bound to the dev-server baseURL
// (http://127.0.0.1:3000) and absolute URLs to the Rust API port
// (31400) are not honored in this env.  The proxy at /api/proxy
// forwards to 127.0.0.1:31400 and pins the bypass-auth actor.
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

async function getV1(req: APIRequestContext, path: string) {
  return req.get(PROXY + path, {
    headers: { "x-owner-id": OWNER, "x-actor-id": ACTOR },
  });
}

test.describe("v1 - recurring tile edit title", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("editing the title of a recurring-sourced placement updates both placement and recurring", async ({ page, request }) => {
    var day = todayUtc();
    var original = "Daily original " + Date.now();
    var updated = "Daily updated " + Date.now();

    var createRes = await postV1(request, "/v1/tiles", {
      idempotency_key: uuidv7like(),
      payload: { kind: 0, title: original, description: null, color: "#3b82f6", icon: "check", external_id: null, plan_role: 0 },
    });
    expect(createRes.status()).toBeLessThan(300);
    var created = await createRes.json();
    var tileId = created.aggregate.id;

    var ruleRes = await postV1(request, "/v1/recurring/" + tileId + "/frame-rules", {
      idempotency_key: uuidv7like(),
      payload: {
        recurring_id: tileId,
        rule: { id: uuidv7like(), active: null, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } },
      },
    });
    expect(ruleRes.status()).toBeLessThan(300);
    var fruid = execFileSync("docker", [
      "exec", "-i", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-At",
      "-c", "SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = 'PLACEHOLDER' LIMIT 1;".replace("PLACEHOLDER", tileId),
    ], { encoding: "utf8" }).trim();

    var matRes = await postV1(request, "/v1/recurring/" + tileId + "/frame-rules/" + fruid + "/materialize", {
      idempotency_key: uuidv7like(),
      payload: { recurring_id: tileId, frame_rule_id: fruid, range_start: day + "T09:00:00.000Z", range_end: day + "T10:00:00.000Z" },
    });
    expect(matRes.status()).toBeLessThan(300);

    await page.goto("/dashboard/calendar?view=day&anchor=" + day);
    var dayTile = page.locator("[data-testid^=day-event-], [data-event-id]", { hasText: original }).first();
    await expect(dayTile).toBeVisible({ timeout: 10_000 });

    await dayTile.click();
    var submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    var titleInput = page.locator("input[aria-required='true']").first();
    await expect(titleInput).toHaveValue(original);

    await titleInput.fill(updated);
    await submit.click();
    await expect(submit).not.toBeVisible({ timeout: 10_000 });

    // /v1/timeline joins placement -> tile; an UPDATE_TILE on the
    // recurring tile must immediately show the new title on every
    // existing placement.  Use the placement's `tile_id` here
    // because the POST /v1/tiles response `aggregate.id` returns the
    // v1_recurring id, NOT the v1_tile id.
    var tlRes = await getV1(request, "/v1/timeline?start=" + day + "T00:00:00Z&end=" + day + "T23:59:59Z");
    expect(tlRes.status()).toBe(200);
    var tl = await tlRes.json();
    var tlMatch = (tl || []).find(function (p: { content?: { title?: string } }) { return p.content && p.content.title === updated; });
    expect(tlMatch, "placement title should be updated in /v1/timeline").toBeTruthy();
    var placementTileId = tlMatch.tile_id;
    expect(placementTileId, "placement must carry tile_id from /v1/timeline").toBeTruthy();

    // The underlying recurring tile's title is also updated.
    var tileRes = await getV1(request, "/v1/tiles/" + placementTileId);
    expect(tileRes.status()).toBe(200);
    var tile = await tileRes.json();
    expect(tile.title, "recurring tile title should be updated").toBe(updated);
  });
});
