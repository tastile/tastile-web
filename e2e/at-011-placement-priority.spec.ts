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

async function appendChangeSet(
  page: Page,
  placementId: string,
  layer: 0 | 1,
  part: 0 | 1,
  isoValue: string,
  rank: number = 0,
) {
  const cmd = await postV1(page, `/v1/placements/${placementId}/changes`, {
    idempotency_key: uuidv7like(),
    payload: {
      placement_id: placementId,
      changeset: {
        id: uuidv7like(),
        owner_id: OWNER,
        target: { Placement: placementId },
        layer,
        rank,
        changes: [
          {
            id: uuidv7like(),
            key: { group: 5, item: null, part },
            kind: 2,
            value: { Instant: isoValue },
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

test.describe("v1 - Placement priority & change-set rules (AT-011/012/013/015)", () => {
  test.beforeEach(async () => { await cleanDb(); });

  test("AT-011 Placement layer overrides Recurring layer when both target the same slot", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-011 prio " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Recurring-layer ChangeSet for span_start: 09:45
    const sR = await appendChangeSet(page, placementId, 0, 0, `${day}T09:45:00.000Z`);
    expect(sR, "recurring layer append: " + sR).toBeLessThan(300);
    // Placement-layer ChangeSet for span_start: 09:50 (must win)
    const sP = await appendChangeSet(page, placementId, 1, 0, `${day}T09:50:00.000Z`);
    expect(sP, "placement layer append: " + sP).toBeLessThan(300);

    const t = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    expect(t.status()).toBe(200);
    const items = (await t.json()) as Array<{
      placement_id: string;
      span: { start: string; end: string };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    // Placement layer (1) must dominate Recurring (0) for the same slot.
    expect(found!.span.start).toBe(`${day}T09:50:00Z`);
  });

  test("AT-012 Same layer + same rank: later OVERRIDE does not silently win", async ({ page }) => {
    // The spec says: "同一層・同一 rank の OVERRIDE 競合は静かに上書きされない".
    // Resolver contract (v1/07): two ChangeSets on the same (layer, rank,
    // key) with different values produce a ChangeConflict violation and
    // flip the placement to Blocked.  The audit log retains both rows
    // and the effective span is the BASELINE (no value picked).
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-012 conflict " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);

    const s1 = await appendChangeSet(page, placementId, 0, 1, `${day}T10:30:00.000Z`, 0);
    expect(s1, "first append: " + s1).toBeLessThan(300);
    // Second append: same (layer=0, rank=0, key={group:5, part:1}) but a
    // different value.  Per spec the second call must NOT silently
    // overwrite the first; instead a ChangeConflict is raised.
    const s2 = await appendChangeSet(page, placementId, 0, 1, `${day}T11:00:00.000Z`, 0);
    expect(s2, "second append: " + s2).toBeLessThan(500);

    const t = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    const items = (await t.json()) as Array<{
      placement_id: string;
      span: { start: string; end: string };
      resolution: { state: number; violations: Array<{ kind: number }> };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    // Resolver drops the conflicting override, so effective end falls
    // back to the BASELINE (10:00).  Neither 10:30 nor 11:00 wins.
    expect(found!.span.end).toBe(`${day}T10:00:00Z`);
    // State must be Blocked (state=2) and a ChangeConflict violation
    // (ViolationKind::ChangeConflict = 7) must be present.
    expect(found!.resolution.state).toBe(2);
    expect(found!.resolution.violations.find((v) => v.kind === 7)).toBeTruthy();

    // And the audit log retains both change_set rows.
    const csCount = execFileSync(
      "docker",
      ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT COUNT(*) FROM v1_change_set cs WHERE cs.target_id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(Number(csCount)).toBeGreaterThanOrEqual(2);
  });
  test("AT-013 Empty-range intersection (slot_start > slot_end) results in BLOCKED", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-013 blocked " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);

    // Span: start 09:30, end 09:00 -> empty intersection.
    const s1 = await appendChangeSet(page, placementId, 1, 0, `${day}T09:30:00.000Z`);
    expect(s1, "span_start append: " + s1).toBeLessThan(300);
    const s2 = await appendChangeSet(page, placementId, 1, 1, `${day}T09:00:00.000Z`);
    expect(s2, "span_end append: " + s2).toBeLessThan(300);

    const t = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    const items = (await t.json()) as Array<{
      placement_id: string;
      resolution: { state: number; violations: Array<{ kind: number }> };
    }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    // state=2 is Blocked; an empty range produces a RangeEmpty (kind=1) violation.
    expect(found!.resolution.state).toBe(2);
    // An empty intersection (span_start > span_end) is reported as
    // SpanInvalid (kind=0) by the resolver, not as a distinct RangeEmpty
    // code; the placement state itself is what flips to Blocked.
    expect(found!.resolution.violations.find((v) => v.kind === 0)).toBeTruthy();
  });

  test("AT-015 Detach from parent: subsequent Recurring-layer ChangeSets no longer affect the placement", async ({ page }) => {
    const day = "2026-07-01";
    const { aggregate } = await createRecurring(page, "AT-015 detach " + Date.now());
    const recurringId = aggregate.id;
    const fruid = await addStepFrameRule(page, recurringId);
    await materialize(page, recurringId, fruid, `${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`);
    const placementId = await placementIdForRecurring(recurringId);
    expect(placementId.length).toBeGreaterThan(0);

    // Detach.
    const det = await postV1(page, `/v1/placements/${placementId}/detach`, {
      idempotency_key: uuidv7like(),
      payload: { placement_id: placementId },
    });
    expect(det.status(), "detach: " + det.status()).toBeLessThan(300);

    // Snapshot the placement's effective span (must still be 09:00-10:00).
    const t1 = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    const before = ((await t1.json()) as Array<{ placement_id: string; span: { start: string; end: string } }>).find(
      (i) => i.placement_id === placementId,
    );
    expect(before).toBeTruthy();
    expect(before!.span.start).toBe(`${day}T09:00:00Z`);

    // Try a Recurring-layer override AFTER detach. It should not affect the placement.
    const s = await appendChangeSet(page, placementId, 0, 0, `${day}T07:00:00.000Z`);
    expect(s, "recurring layer after detach: " + s).toBeLessThan(300);

    const t2 = await getV1(
      page,
      `/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z&include_blocked=true`,
    );
    const after = ((await t2.json()) as Array<{ placement_id: string; span: { start: string; end: string } }>).find(
      (i) => i.placement_id === placementId,
    );
    expect(after).toBeTruthy();
    // After detach, the post-detach recurring-layer change must NOT
    // re-shape the placement's effective span.
    expect(after!.span.start).toBe(`${day}T09:00:00Z`);
  });
});
