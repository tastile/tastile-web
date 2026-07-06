// v1 API helpers shared across e2e specs.  These bypass the v0 BFF
// (/api/events) which is now 410 Gone and call the v1 endpoints
// directly via the Next.js proxy at /api/proxy/v1/*.

import { type APIRequestContext, expect } from "@playwright/test";

interface V1CommandResp { aggregate?: { id: string }; }
export interface V1TileView { id: string; planId?: string | null; plan_id?: string | null; }
export interface V1TimelineItem {
  placementId?: string;
  placement_id?: string;
  occurrenceKey?: string;
  content?: { title?: string };
}

export interface V1CreatePlacementInput {
  title: string;
  start: string;
  end: string;
  color?: string;
  icon?: string;
  /** Optional labels to seed as v1_annotation rows (kind=0 / TIME_WINDOW) */
  labels?: string[];
}

function newIdemKey(): string {
  return crypto.randomUUID();
}

export async function v1CreatePlacement(
  client: { request: APIRequestContext },
  input: V1CreatePlacementInput,
): Promise<{ tileId: string; planId: string; placementId: string }> {
  const req = client.request;

  // 1) Create Placement tile (kind=1).  Server also writes a v1_plan row
  //    in the same transaction.
  const tileRes = await req.post("/api/proxy/v1/tiles", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: newIdemKey(),
      payload: {
        kind: 1, // PLACEMENT
        title: input.title,
        description: null,
        color: input.color ?? "#3b82f6",
        icon: input.icon ?? "check-circle",
        external_id: null,
        plan_role: 0, // EXECUTABLE
        owner_subject_id: null,
      },
    },
  });
  expect(tileRes.status()).toBeLessThan(400);
  const tile = (await tileRes.json()) as V1CommandResp;
  const tileId = tile.aggregate?.id;
  if (!tileId) throw new Error("v1/tiles response missing aggregate.id");

  // 2) Read back the auto-created plan_id.
  const tileViewRes = await req.get("/api/proxy/v1/tiles/" + tileId);
  expect(tileViewRes.status()).toBeLessThan(400);
  const tileView = (await tileViewRes.json()) as V1TileView;
  const planId = tileView.planId ?? tileView.plan_id ?? null;
  if (!planId) throw new Error("v1 tile " + tileId + " has no plan_id");

  // 3) Create Placement (Manual source = 0).
  const placementRes = await req.post("/api/proxy/v1/placements", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: newIdemKey(),
      payload: {
        tile_id: tileId,
        plan_id: planId,
        source: 0, // MANUAL
        source_ref: {
          created: null, recurring: null, flow: null,
          frame: null, proposal: null, source_text: null, external_id: null,
        },
        baseline: {
          span: { start: input.start, end: input.end },
          inside: null,
        },
      },
    },
  });
  expect(placementRes.status()).toBeLessThan(400);
  const placement = (await placementRes.json()) as V1CommandResp;
  const placementId = placement.aggregate?.id;
  if (!placementId) throw new Error("v1/placements response missing aggregate.id");
  // 4) Optional: seed v1_annotation rows for tag-suggest tests.
  //    v1 has no public write API for v1_annotation in Phase A,
  //    so we insert directly via docker exec.  kind=0 (TIME_WINDOW).
  if (input.labels && input.labels.length > 0) {
    const { execFileSync } = await import("node:child_process");
    for (const label of input.labels) {
      if (!label) continue;
      const escaped = label.replace(/'/g, "''");
      const annId = crypto.randomUUID();
      const sql = "INSERT INTO v1_annotation (id, tile_id, kind, label, owner_id, revision, created_at, updated_at) VALUES ('" + annId + "'::uuid, '" + tileId + "'::uuid, 0, '" + escaped + "', '00000000-0000-0000-0000-000000000001'::uuid, 1, now(), now()) ON CONFLICT (id) DO NOTHING;";
      try {
        execFileSync("docker", ["exec", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql], { stdio: "ignore" });
      } catch (e) { void e; }
    }
  }

  return { tileId, planId, placementId };
}

/**
 * Convenience wrapper: create a placement then resolve its
 * occurrence key (the value the day-view uses in data-tile-id /
 * getByTestId) via the /v1/timeline read path.
 */
export async function v1CreatePlacementAndResolve(
  client: { request: APIRequestContext },
  input: V1CreatePlacementInput,
): Promise<{ tileId: string; planId: string; placementId: string; occurrenceId: string }> {
  const { tileId, planId, placementId } = await v1CreatePlacement(client, input);
  const tlRes = await client.request.get(
    "/api/proxy/v1/timeline?start=" + encodeURIComponent(input.start) + "&end=" + encodeURIComponent(input.end),
  );
  expect(tlRes.status()).toBeLessThan(400);
  const items = (await tlRes.json()) as V1TimelineItem[];
  const occ = items.find((i) => (i.placementId ?? i.placement_id) === placementId);
  if (!occ) throw new Error("no timeline item for placement " + placementId);
  const occurrenceId = occ.occurrenceKey ?? (occ.placementId ?? occ.placement_id)!;
  return { tileId, planId, placementId, occurrenceId };
}

/**
 * Truncate all v1 tables in the canonical cleanup order so the next
 * test sees a fully empty calendar.  Goes through docker exec on the
 * tastile-core-db-1 container.
 */
export async function truncateV1(): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(
      "docker",
      [
        "exec", "tastile-core-db-1",
        "psql", "-U", "tastile", "-d", "tastile_db", "-c",
        "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation RESTART IDENTITY CASCADE;",
      ],
      { stdio: "ignore" },
    );
  } catch {
    // No-op; docker exec is the canonical cleanup path.
  }
}
/**
 * Create a v1 Recurring tile (kind=0) + Step frame-rule + materialize
 * occurrences for every weekday in `weekdayMaskV1` (bit 0=Mon..6=Sun)
 * with the given local-zone `timeOfDay` window.  Returns the tile id,
 * the frame-rule id, and the list of materialized placement ids.
 *
 * Mirrors the createRecurringCommand UI flow that now runs when the
 * user toggles weekday + start/end in the QuickCreate panel.
 */
export async function v1CreateWeeklyRecurring(
  client: { request: APIRequestContext },
  input: {
    title: string;
    anchorStart: string; // ISO of the first occurrence; used as pattern anchor.
    anchorEnd: string;
    weekdayMaskV1: number;
    timeOfDay: { start: string; end: string };
    occurrences?: number;
    color?: string;
    icon?: string;
    planRole?: number;
  },
): Promise<{ tileId: string; actualTileId: string; frameRuleId: string; placementIds: string[] }> {
  const req = client.request;
  const occurrences = Math.min(60, Math.max(1, input.occurrences ?? 14));
  const tileRes = await req.post("/api/proxy/v1/tiles", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        kind: 0,
        title: input.title,
        description: null,
        color: input.color ?? "#3b82f6",
        icon: input.icon ?? "check-circle",
        external_id: null,
        plan_role: input.planRole ?? 0,
        owner_subject_id: null,
      },
    },
  });
  expect(tileRes.status(), "POST /v1/tiles").toBeLessThan(400);
  const tile = (await tileRes.json()) as V1CommandResp;
  const tileId = tile.aggregate?.id;
  if (!tileId) throw new Error("v1/tiles response missing aggregate.id");
  // POST /v1/tiles for a Recurring returns the recurring id, not the
  // underlying v1_tile.id.  Read back from /v1/recurring/{id} (which
  // returns RecurringView including the v1_tile.id) so callers can
  // correlate with /v1/timeline items (whose tile_id is the v1_tile.id).
  let actualTileId = tileId;
  const recurringViewRes = await req.get("/api/proxy/v1/recurring/" + tileId);
  if (recurringViewRes.status() < 400) {
    const view = (await recurringViewRes.json()) as { tile_id?: string };
    if (view.tile_id) actualTileId = view.tile_id;
  }

  const frameRuleId = crypto.randomUUID();
  const ruleRes = await req.post(`/api/proxy/v1/recurring/${tileId}/frame-rules`, {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        recurring_id: tileId,
        rule: {
          id: frameRuleId,
          active: null,
          rank: 0,
          generator: {
            Step: { step: 86_400_000, origin: null, bounds: null },
          },
        },
      },
    },
  });
  expect(ruleRes.status(), "POST frame-rule").toBeLessThan(400);

  // Expand the weekly pattern into per-occurrence materialize ranges
  // (same logic as createRecurringCommand.expandPatternRanges).
  const ranges = expandWeeklyV1(
    input.anchorStart,
    input.weekdayMaskV1,
    input.timeOfDay,
    occurrences,
  );
  const placementIds: string[] = [];
  for (const r of ranges) {
    const matRes = await req.post(
      `/api/proxy/v1/recurring/${tileId}/frame-rules/${frameRuleId}/materialize`,
      {
        headers: { "content-type": "application/json" },
        data: {
          idempotency_key: crypto.randomUUID(),
          payload: {
            recurring_id: tileId,
            frame_rule_id: frameRuleId,
            range_start: r.start,
            range_end: r.end,
          },
        },
      },
    );
    expect(matRes.status(), "POST materialize").toBeLessThan(400);
    const mat = (await matRes.json()) as V1CommandResp;
    if (mat.aggregate?.id) placementIds.push(mat.aggregate.id);
  }
  return { tileId, actualTileId, frameRuleId, placementIds };
}

function expandWeeklyV1(
  anchorIso: string,
  weekdayMaskV1: number,
  timeOfDay: { start: string; end: string },
  occurrenceCount: number,
): Array<{ start: string; end: string }> {
  if (occurrenceCount <= 0) return [];
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) return [];
  const toMin = (hhmm: string) => {
    const [hStr = "0", mStr = "0"] = hhmm.split(":");
    return Number(hStr) * 60 + Number(mStr);
  };
  const startMin = toMin(timeOfDay.start);
  const endMin = toMin(timeOfDay.end);
  if (endMin <= startMin) return [];
  const out: Array<{ start: string; end: string }> = [];
  const maxDays = 366;
  for (let dayOffset = 0; dayOffset < maxDays && out.length < occurrenceCount; dayOffset++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dayOffset);
    const jsDay = d.getDay(); // 0=Sun..6=Sat
    // map to v1 bit: jsDay 0=Sun -> v1 6; otherwise jsDay-1
    const v1Bit = jsDay === 0 ? 6 : jsDay - 1;
    if ((weekdayMaskV1 & (1 << v1Bit)) === 0) continue;
    const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(startMin / 60), startMin % 60, 0, 0);
    const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(endMin / 60), endMin % 60, 0, 0);
    out.push({ start: startDate.toISOString(), end: endDate.toISOString() });
  }
  return out;
}