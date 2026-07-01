import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const V1_BASE = "http://127.0.0.1:31400";

function uuidv7like(): string {
  // Random UUIDv4 is fine for e2e uniqueness; the v1 API does not
  // validate the version bits on incoming ids. Group 4 must be 12 hex
  // chars exactly.
  const h = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n))
      .toString(16)
      .padStart(n, "0");
  return `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`;
}

async function cleanDb(): Promise<void> {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "tastile-core-db-1",
      "psql",
      "-U",
      "tastile",
      "-d",
      "tastile_db",
      "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

async function postV1(
  page: Page,
  path: string,
  body: Record<string, unknown>,
) {
  return page.request.post(`${V1_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      "x-owner-id": OWNER,
      "x-actor-id": ACTOR,
    },
    data: body,
  });
}

test.describe("v1 — recurring tile flows through to placement in occurrences", () => {
  test.beforeEach(async () => {
    await cleanDb();
  });

  test("create recurring tile + frame rule + materialize produces a placement visible in /api/events/occurrences", async ({
    page,
  }) => {
    const day = "2026-07-01";
    const title = "Recurring v1 e2e " + Date.now();

    // 1) Create a Recurring tile (kind=0) via v1.
    const createRes = await postV1(page, "/v1/tiles", {
      idempotency_key: uuidv7like(),
      payload: {
        kind: 0,
        title,
        description: null,
        color: "#22c55e",
        icon: "check",
        external_id: null,
        plan_role: 0,
      },
    });
    expect(createRes.status(), `POST /v1/tiles status: ${createRes.status()}`).toBeLessThan(300);
    const created = (await createRes.json()) as {
      aggregate: { kind: number; id: string };
    };
    const tileId = created.aggregate.id;
    // The Recurring row uses the same uuid as the tile aggregate id.
    const recurringId = tileId;

    // 2) Add a Step FrameRule. The v1 system assigns its own id; we
    //    pick a fresh candidate id and then read the assigned one back
    //    from the database.
    const ruleRes = await postV1(
      page,
      `/v1/recurring/${recurringId}/frame-rules`,
      {
        idempotency_key: uuidv7like(),
        payload: {
          recurring_id: recurringId,
          rule: {
            id: uuidv7like(),
            active: null,
            rank: 0,
            generator: {
              Step: { step: 86_400_000, origin: null, bounds: null },
            },
          },
        },
      },
    );
    expect(ruleRes.status(), `POST frame-rules status: ${ruleRes.status()}`).toBeLessThan(300);

    const fruid = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "tastile-core-db-1",
        "psql",
        "-U",
        "tastile",
        "-d",
        "tastile_db",
        "-At",
        "-c",
        `SELECT id FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}' LIMIT 1;`,
      ],
      { encoding: "utf8" },
    ).trim();
    expect(fruid.length, "frame rule id should be discoverable").toBeGreaterThan(0);

    // 3) Materialize the frame for a specific 1h slot.
    const matRes = await postV1(
      page,
      `/v1/recurring/${recurringId}/frame-rules/${fruid}/materialize`,
      {
        idempotency_key: uuidv7like(),
        payload: {
          recurring_id: recurringId,
          frame_rule_id: fruid,
          range_start: `${day}T09:00:00.000Z`,
          range_end: `${day}T10:00:00.000Z`,
        },
      },
    );
    expect(matRes.status(), `POST materialize status: ${matRes.status()}`).toBeLessThan(300);

    // 4) /v1/timeline (with auth headers) should now return the
    //    placement with source.kind=1 (Recurring).
    const timelineRes = await page.request.get(
      `${V1_BASE}/v1/timeline?start=${day}T00:00:00Z&end=${day}T23:59:59Z`,
      {
        headers: { "x-owner-id": OWNER, "x-actor-id": ACTOR },
      },
    );
    expect(timelineRes.status()).toBe(200);
    const timeline = (await timelineRes.json()) as Array<{
      placement_id: string;
      content: { title: string };
      span: { start: string; end: string };
      source: { kind: number };
    }>;
    const recPlacement = timeline.find(
      (i) => i.content?.title === title && i.source?.kind === 1,
    );
    expect(recPlacement, "placement with source.kind=1 should appear in /v1/timeline").toBeTruthy();
    expect(recPlacement!.span.start).toBe(`${day}T09:00:00Z`);
    expect(recPlacement!.span.end).toBe(`${day}T10:00:00Z`);

    // 5) The web bridge /api/events/occurrences should also surface it.
    const occRes = await page.request.get(
      `/api/events/occurrences?start=${day}T00:00:00.000Z&end=${day}T23:59:59.999Z&min_minutes=0&include_recurring=true`,
    );
    expect(occRes.status()).toBe(200);
    const occ = (await occRes.json()) as {
      occurrences: Array<{ id: string; title: string; start: string; end: string }>;
    };
    const found = (occ.occurrences ?? []).find(
      (o) => o.title === title && o.start === `${day}T09:00:00Z`,
    );
    expect(
      found,
      `expected occurrences to include recurring-sourced placement for "${title}"`,
    ).toBeTruthy();
  });
});
