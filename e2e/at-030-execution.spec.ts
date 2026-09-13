import { test, expect, type Page } from "@playwright/test";
import { v1AuthHeaders } from "./helpers/v1";

const OWNER = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000001";
const V1_BASE = "http://127.0.0.1:31400";

function uuidv7like(): string {
  // crypto.randomUUID() is v4; v7 is not exposed in Node 20. The daemon
  // does not validate the UUID version on idempotency_key — any unique
  // string works. Use crypto.randomUUID() for collision-free idem keys.
  return crypto.randomUUID();
}

async function cleanDb(): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  // Same 12-table truncate the canonical quick-tile-create spec uses;
  // routed through the `docker` shim so wslc unavailability on this host
  // does not surface as a test flake (the shim maps to the local PG).
  // Retries on transient 40P01 deadlock / 40P05 wedge once before
  // failing the test.
  const sql =
    "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation, v1_source_tile, v1_source_lifecycle_event, v1_decision_session, v1_delivery, v1_feedback_txn RESTART IDENTITY CASCADE;";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      execFileSync("docker", ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql], {
        stdio: "ignore",
        timeout: 60_000,
      });
      return;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const transient = msg.includes("40P01") || msg.includes("40P05") || msg.includes("ETIMEDOUT");
      if (attempt === 2 || !transient) throw err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

const auth = v1AuthHeaders();
async function postV1(page: Page, path: string, body: unknown) {
  return page.request.post(`${V1_BASE}${path}`, { headers: auth, data: body });
}
async function getV1(page: Page, path: string) {
  return page.request.get(`${V1_BASE}${path}`, { headers: auth });
}

// Create a one-shot SourceTile whose generation_at anchors at the given
// day/time. The publish command materializes a Placement synchronously
// (kind=0 OneTime) and returns the placement id via aggregate_meta, so
// the worker tick is not on the critical path.
async function createSourceTile(page: Page, title: string, atIso: string) {
  const horizonEnd = new Date(new Date(atIso).getTime() + 60 * 60_000).toISOString();
  const body = {
    idempotency_key: uuidv7like(),
    payload: {
      tile: { title, description: null, color: "#0ea5e9", icon: "check" },
      plan: {
        role: 0,
        references: [],
        completion: { root: { All: [] }, time_requirements: [], tasks: [] },
        planning: { placement_rules: [], nesting_rules: [] },
        metrics: [],
        decisions: [],
      },
      flows: [],
      schedule: {
        required_duration_ms: 60 * 60_000,
        priority: 0,
        generation: { kind: 0, at: atIso },
        window: { start_offset_ms: 0, end_offset_ms: 60 * 60_000 },
        split_policy: { kind: 0 },
      },
      horizon: { start: atIso, end: horizonEnd },
    },
  };
  const r = await postV1(page, "/v1/source-tiles?owner_id=" + OWNER, body);
  expect(r.status(), `POST /v1/source-tiles status: ${r.status()}`).toBeLessThan(300);
  const json = (await r.json()) as {
    aggregate?: { id?: string };
    aggregate_meta?: { placement_ids?: string[] };
  };
  const placementId = json.aggregate_meta?.placement_ids?.[0];
  expect(placementId, "source-tile publish must materialize a placement").toBeTruthy();
  return { sourceTileId: json.aggregate?.id ?? "", placementId };
}

// Append a Placement-layer ChangeSet that sets span_start or span_end.
// kind: 2 = Put, layer: 1 = Placement, source: 2 = User
async function appendChangeSet(page: Page, placementId: string, slot: 0 | 1, instant: string) {
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

async function startExecution(page: Page, placementId: string) {
  const r = await postV1(page, "/v1/placements/"+placementId+"/executions", {
    idempotency_key: uuidv7like(),
    payload: { placement_id: placementId },
  });
  if (r.status() >= 300) throw new Error("startExecution: "+r.status());
  return await r.json();
}
async function pauseExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/pause", {
    idempotency_key: uuidv7like(), payload: null,
  })).status();
}
async function resumeExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/resume", {
    idempotency_key: uuidv7like(), payload: null,
  })).status();
}
async function finishExecution(page: Page, exId: string) {
  return (await postV1(page, "/v1/executions/"+exId+"/finish", {
    idempotency_key: uuidv7like(),
    payload: { kind: 0, note: null },
  })).status();
}

test.describe.serial("v1 - Execution (AT-030 / AT-031 / AT-032 / AT-033 / AT-035)", () => {
  // Truncate once per file (the worker is long-lived across specs and
  // shares the same DB; serial + beforeAll avoids a TRUNCATE racing with
  // the worker's source_tick for the previous spec's last placement).
  test.beforeAll(async () => { await cleanDb(); });

  test("AT-030 start_execution returns execution; GET /v1/executions/{id} shows state=Active, captured_at set, placement_id matches", async ({ page }) => {
    const { placementId } = await createSourceTile(page, "AT-030 daily " + Date.now(), "2026-09-14T01:00:00Z");
    expect(placementId.length).toBeGreaterThan(0);

    const start = await startExecution(page, placementId);
    expect(start.aggregate.id.length).toBeGreaterThan(0);

    const view = await getV1(page, "/v1/executions/"+start.aggregate.id);
    expect(view.status()).toBe(200);
    const body = (await view.json()) as {
      id: string; state: number; placement_id: string;
      captured_at: string | null; open_segment_kind: number | null; segment_count: number;
    };
    expect(body.id).toBe(start.aggregate.id);
    expect(body.state).toBe(0);
    expect(body.placement_id).toBe(placementId);
    expect(body.captured_at).not.toBeNull();
    expect(body.open_segment_kind).toBe(0);
    expect(body.segment_count).toBe(1);
  });

  test("AT-031 StartExecution captures placement_revision; later ChangeSet does not change basis.placement_revision", async ({ page }) => {
    // Anchor each test at a unique hour to avoid the seeded 休憩
    // placement (every 30 min) blocking the OneTime materialization.
    const { placementId } = await createSourceTile(page, "AT-031 daily " + Date.now(), "2026-09-14T03:00:00Z");

    const start = await startExecution(page, placementId);
    const basis1 = (await (await getV1(page, "/v1/executions/"+start.aggregate.id+"/basis")).json()) as {
      placement_revision: number; placement_id: string;
    };
    const originalRev = basis1.placement_revision;
    expect(basis1.placement_id).toBe(placementId);

    const cs = await appendChangeSet(page, placementId, 0, "2026-09-14T03:30:00.000Z");
    expect(cs).toBeLessThan(300);

    const basis2 = (await (await getV1(page, "/v1/executions/"+start.aggregate.id+"/basis")).json()) as {
      placement_revision: number; placement_id: string;
    };
    expect(basis2.placement_revision).toBe(originalRev);
    expect(basis2.placement_id).toBe(placementId);

    const { execFileSync } = await import("node:child_process");
    const cur = execFileSync(
      "wslc",
      ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT revision FROM v1_placement WHERE id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(Number(cur)).toBeGreaterThan(originalRev);
  });

  test("AT-032 two StartExecution calls on the same placement return the same execution_id (idempotent)", async ({ page }) => {
    const { placementId } = await createSourceTile(page, "AT-032 daily " + Date.now(), "2026-09-14T05:00:00Z");

    const a = await startExecution(page, placementId);
    const b = await startExecution(page, placementId);
    expect(a.aggregate.id).toBe(b.aggregate.id);

    const { execFileSync } = await import("node:child_process");
    const cnt = execFileSync(
      "wslc",
      ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c",
       `SELECT count(*) FROM v1_execution e JOIN v1_execution_basis b ON b.execution_id = e.id WHERE b.placement_id = '${placementId}';`],
      { encoding: "utf8" },
    ).trim();
    expect(cnt).toBe("1");
  });

  test("AT-033 start -> pause -> resume toggles state and open_segment_kind; segment_count grows", async ({ page }) => {
    const { placementId } = await createSourceTile(page, "AT-033 daily " + Date.now(), "2026-09-14T07:00:00Z");

    const start = await startExecution(page, placementId);
    const exId = start.aggregate.id;

    expect(await pauseExecution(page, exId)).toBeLessThan(300);
    const paused = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; open_segment_kind: number | null; segment_count: number;
    };
    expect(paused.state).toBe(1);
    expect(paused.open_segment_kind).toBe(1);
    expect(paused.segment_count).toBe(2);

    expect(await resumeExecution(page, exId)).toBeLessThan(300);
    const resumed = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; open_segment_kind: number | null; segment_count: number;
    };
    expect(resumed.state).toBe(0);
    expect(resumed.open_segment_kind).toBe(0);
    expect(resumed.segment_count).toBe(3);
  });

  test("AT-035 start -> finish(kind=Normal) closes the execution; placement span in /v1/timeline is unchanged", async ({ page }) => {
    const { placementId } = await createSourceTile(page, "AT-035 daily " + Date.now(), "2026-09-14T09:00:00Z");

    const start = await startExecution(page, placementId);
    const exId = start.aggregate.id;

    expect(await finishExecution(page, exId)).toBeLessThan(300);

    const after = (await (await getV1(page, "/v1/executions/"+exId)).json()) as {
      state: number; finished_at: string | null; finish_kind: number | null;
    };
    expect(after.state).toBe(2);
    expect(after.finished_at).not.toBeNull();
    expect(after.finish_kind).toBe(0);

    expect(await pauseExecution(page, exId)).toBeGreaterThanOrEqual(400);

    const tl = await getV1(page, "/v1/timeline?start=2026-09-14T00:00:00Z&end=2026-09-14T23:59:59Z");
    const items = (await tl.json()) as Array<{ placement_id: string; span: { start: string; end: string } }>;
    const found = items.find((i) => i.placement_id === placementId);
    expect(found).toBeTruthy();
    // SourceTile (OneTime, kind=0) materializes the placement at exactly
    // the authored generation_at instant, spanning required_duration_ms.
    expect(found!.span.start).toBe("2026-09-14T09:00:00Z");
    expect(found!.span.end).toBe("2026-09-14T10:00:00Z");
  });

});
