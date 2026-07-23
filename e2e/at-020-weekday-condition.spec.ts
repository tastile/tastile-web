import { test, expect, type APIRequestContext } from "@playwright/test";
import { v1AuthHeaders } from "./helpers/v1";
import { execFileSync } from "node:child_process";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const PROXY = "/api/proxy";

function uuidv7like(): string {
  const h = (n: number) => Math.floor(Math.random() * Math.pow(16, n)).toString(16).padStart(n, "0");
  return h(8) + "-" + h(4) + "-" + h(4) + "-" + h(4) + "-" + h(12);
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
    ...v1AuthHeaders(),
    data: body,
  });
}

// CalendarTerm weekday mask: bit0=Mon..bit6=Sun
const MASK_MON_FRI = 0b0011111; // Mon..Fri
const MASK_TUE = 0b0000010;     // Tue
const MASK_WED = 0b0000100;     // Wed

async function makeRecurring(req: APIRequestContext, title: string): Promise<string> {
  const res = await postV1(req, "/v1/tiles", {
    idempotency_key: uuidv7like(),
    payload: { kind: 0, title, description: null, color: "#3b82f6", icon: "check", external_id: null, plan_role: 0 },
  });
  expect(res.status()).toBeLessThan(300);
  return (await res.json()).aggregate.id;
}

async function addFrameRuleWithCondition(
  req: APIRequestContext,
  recurringId: string,
  weekdayMask: number,
): Promise<string> {
  // active condition: weekdayMask AND NOT_HOLIDAY (holiday_kind=0)
  const cond = {
    All: [
      { Term: { Calendar: { weekday_mask: weekdayMask, time_start: null, time_end: null, holiday_kind: 2, date_range: null, offset_min: 0 } } },
      { Term: { Calendar: { weekday_mask: 0, time_start: null, time_end: null, holiday_kind: 0, date_range: null, offset_min: 0 } } },
    ],
  };
  const ruleRes = await postV1(req, "/v1/recurring/" + recurringId + "/frame-rules", {
    idempotency_key: uuidv7like(),
    payload: {
      recurring_id: recurringId,
      rule: { id: uuidv7like(), active: cond, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } },
    },
  });
  expect(ruleRes.status()).toBeLessThan(300);
  return execFileSync("docker", [
    "exec", "-i", "tastile-core-db-1",
    "psql", "-U", "tastile", "-d", "tastile_db", "-At",
    "-c", "SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '" + recurringId + "' LIMIT 1;",
  ], { encoding: "utf8" }).trim();
}

async function materialize(
  req: APIRequestContext,
  recurringId: string,
  fruid: string,
  dayIso: string,
) {
  return postV1(req, "/v1/recurring/" + recurringId + "/frame-rules/" + fruid + "/materialize", {
    idempotency_key: uuidv7like(),
    payload: { recurring_id: recurringId, frame_rule_id: fruid, range_start: dayIso + "T09:00:00.000Z", range_end: dayIso + "T10:00:00.000Z" },
  });
}

function placementCount() {
  return execFileSync("docker", [
    "exec", "-i", "tastile-core-db-1",
    "psql", "-U", "tastile", "-d", "tastile_db", "-At",
    "-c", "SELECT COUNT(*) FROM v1_placement WHERE owner_id = '" + OWNER + "';",
  ], { encoding: "utf8" }).trim();
}

test.describe("v1 - AT-020 FrameRule.active weekday+holiday gate", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("Tuesday-only mask materializes nothing on Mon/Wed", async ({ request }) => {
    const recurringId = await makeRecurring(request, "AT020-1");
    const fruid = await addFrameRuleWithCondition(request, recurringId, MASK_TUE);
    // Mon 2024-01-01: outside Tue mask.
    const mon = "2024-01-01";
    const monRes = await materialize(request, recurringId, fruid, mon);
    expect(monRes.status()).toBeLessThan(300);
    expect(placementCount()).toBe("0");
    // Tue 2024-01-02: matches.
    const tue = "2024-01-02";
    const tueRes = await materialize(request, recurringId, fruid, tue);
    expect(tueRes.status()).toBeLessThan(300);
    expect(placementCount()).toBe("1");
    // Wed 2024-01-03: outside.
    const wed = "2024-01-03";
    const wedRes = await materialize(request, recurringId, fruid, wed);
    expect(wedRes.status()).toBeLessThan(300);
    expect(placementCount()).toBe("1");
  });

  test("Mon..Fri mask skips weekend (Sat/Sun)", async ({ request }) => {
    const recurringId = await makeRecurring(request, "AT020-2");
    const fruid = await addFrameRuleWithCondition(request, recurringId, MASK_MON_FRI);
    // Mon..Fri 2024-01-01..05
    for (let d = 1; d <= 5; d++) {
      const day = "2024-01-" + String(d).padStart(2, "0");
      const r = await materialize(request, recurringId, fruid, day);
      expect(r.status()).toBeLessThan(300);
    }
    expect(placementCount()).toBe("5");
    // Sat 2024-01-06 outside mask.
    const sat = await materialize(request, recurringId, fruid, "2024-01-06");
    expect(sat.status()).toBeLessThan(300);
    expect(placementCount()).toBe("5");
    // Sun 2024-01-07 outside mask.
    const sun = await materialize(request, recurringId, fruid, "2024-01-07");
    expect(sun.status()).toBeLessThan(300);
    expect(placementCount()).toBe("5");
  });
});
