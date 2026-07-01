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
  expect(c.status()).toBeLessThan(300);
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
  expect(r.status()).toBeLessThan(300);
  return execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
     `SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}' LIMIT 1;`],
    { encoding: "utf8" },
  ).trim();
}

async function materialize(page: Page, recurringId: string, fruid: string, start: string, end: string) {
  const m = await postV1(
    page,
    `/v1/recurring/${recurringId}/frame-rules/${fruid}/materialize`,
    { idempotency_key: uuidv7like(), payload: { recurring_id: recurringId, frame_rule_id: fruid, range_start: start, range_end: end } },
  );
  expect(m.status()).toBeLessThan(300);
}

async function placementIdForRecurring(recurringId: string): Promise<string> {
  return execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
     `SELECT s.placement_id FROM v1_placement_source_ref_recurring s WHERE s.recurring_tile = '${recurringId}' LIMIT 1;`],
    { encoding: "utf8" },
  ).trim();
}

// Append a ChangeSet targeting a placement. layer: 0=Recurring, 1=Placement, 2=Execution.
async function appendChangeSet(page: Page, placementId: string, layer: 0 | 1, slot: 0 | 1, instant: string) {
  const cmd = await postV1(page, `/v1/placements/${placementId}/changes`, {
    idempotency_key: uuidv7like(),
    payload: {
      placement_id: placementId,
      changeset: {
        id: uuidv7like(),
        owner_id: OWNER,
        target: { Placement: placementId },
        layer: layer,
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
  return cmd.status();
}

test.describe("v1 - Placement & ChangeSet (AT-010 / AT-014 / AT-016)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-010 Placement layer overrides start, Recurring layer overrides end; both apply independently", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-010 mixed " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Placement layer overrides span_start (slot 0) to 09:30
    const s1 = await appendChangeSet(page, placementId, 1, 0, `${day}T09:30:00.000Z`);
    expect(s1, `placement layer span_start: ${s1}`).toBeLessThan(300);
    // Recurring layer overrides span_end (slot 1) to 11:00
    const s2 = await appendChangeSet(page, placementId, 0, 1, `${day}T11:00:00.000Z`);
    expect(s2, `recurring layer span_end: ${s2}`).toBeLessThan(300);

    const t = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    expect(t.status()).toBe(200);
    const items = (await t.json()) as Array<{
      placement_id: string;
      span: { start: string; end: string };
      resolution: { state: number };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    expect(found!.span.start).toBe(`${day}T09:30:00Z`);
    expect(found!.span.end).toBe(`${day}T11:00:00Z`);
    expect(found!.resolution.state).toBe(0);
  });

  test("AT-014 SpanInvalid: span_start after span_end is not auto-corrected; placement becomes Blocked", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-014 invalid " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Push span_start past the baseline span_end (10:00) -> 11:00.
    const s = await appendChangeSet(page, placementId, 1, 0, `${day}T11:00:00.000Z`);
    expect(s, `append: ${s}`).toBeLessThan(300);

    // The DB should not auto-correct: v1_placement_baseline.span_start is
    // still the original baseline value, NOT a swap of end.
    const baseline = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT span_start::text || '|' || span_end::text FROM v1_placement_baseline WHERE placement_id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(baseline).toBe(`${day} 09:00:00+00|${day} 10:00:00+00`);

    // /v1/timeline?include_blocked=true reports state=Blocked and a
    // SpanInvalid violation (kind=0). The effective span is the
    // resolver's pre-correction output; the placement is never
    // auto-fixed to a valid interval.
    const t = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    expect(t.status()).toBe(200);
    const items = (await t.json()) as Array<{
      placement_id: string;
      resolution: { state: number; violations: Array<{ kind: number }> };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    expect(found!.resolution.state).toBe(2);
    expect(found!.resolution.violations.find((v) => v.kind === 0)).toBeTruthy();
  });

  test("AT-016 Overlapping placements are allowed and both surface in the timeline", async ({ page }) => {
    const day = "2026-07-01";
    // Create two independent recurring tiles + materialize overlapping
    // slots, then verify both placements are in /v1/timeline.
    const titleA = "AT-016 A " + Date.now();
    const titleB = "AT-016 B " + Date.now();
    const a = await createRecurring(page, titleA);
    const b = await createRecurring(page, titleB);
    const fruidA = await addStepFrameRule(page, a.aggregate.id);
    const fruidB = await addStepFrameRule(page, b.aggregate.id);
    await materialize(page, a.aggregate.id, fruidA, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    await materialize(page, b.aggregate.id, fruidB, `${day}T09:30:00.000Z`, `${day}T10:30:00.000Z`);

    const t = await getV1(page, `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z`);
    expect(t.status()).toBe(200);
    const items = (await t.json()) as Array<{
      placement_id: string;
      span: { start: string; end: string };
      content: { title: string };
    }>;
    const aFound = items.find((i) => i.content?.title === titleA);
    const bFound = items.find((i) => i.content?.title === titleB);
    expect(aFound, "first overlap placement in timeline").toBeTruthy();
    expect(bFound, "second overlap placement in timeline").toBeTruthy();
    expect(aFound!.span.start).toBe(`${day}T09:00:00Z`);
    expect(bFound!.span.start).toBe(`${day}T09:30:00Z`);
  });
});
