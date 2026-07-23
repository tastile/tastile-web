import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}



async function deleteAllEvents(_page: Page) { 
  // Wipe both the calendar event table and the placement table directly
  // via docker exec, so the day view is fully empty for the next test.
  // /api/events/{id} only touches v1_event, leaving v1_placement rows
  // around to render in the day view.
  try {
    execFileSync("docker", [
      "exec", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;",
    ], { stdio: "ignore" });
  } catch {
    // No-op: docker exec is the canonical cleanup; the v0 /api/events
    // fallback was removed when v0 endpoints started returning 410.
  }
}

interface CreatedTile { id: string; occurrenceId: string; tileId?: string }

interface V1CommandResp { aggregate?: { id: string }; }
interface V1TileView { id: string; planId?: string | null; plan_id?: string | null; }
interface V1TimelineItem { placementId?: string; placement_id?: string; occurrenceKey?: string; }

async function v1CreatePlacement(
  page: Page,
  input: { title: string; start: string; end: string },
): Promise<{ tileId: string; planId: string; placementId: string }> {
  // 1) Create Placement tile (kind=1).  Server auto-creates v1_plan.
  const tileRes = await page.request.post("/api/proxy/v1/tiles", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        kind: 1, // PLACEMENT
        title: input.title,
        description: null,
        color: "#3b82f6",
        icon: "check-circle",
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
  const tileViewRes = await page.request.get(`/api/proxy/v1/tiles/${tileId}`);
  expect(tileViewRes.status()).toBeLessThan(400);
  const tileView = (await tileViewRes.json()) as V1TileView;
  const planId = tileView.planId ?? tileView.plan_id ?? null;
  if (!planId) throw new Error("v1 tile " + tileId + " has no plan_id");

  // 3) Create Placement (Manual source = 0).
  const placementRes = await page.request.post("/api/proxy/v1/placements", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
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
  return { tileId, planId, placementId };
}

async function createEventViaApi(
  page: Page,
  input: { title: string; start: string; end: string },
): Promise<CreatedTile> {
  const { tileId, placementId } = await v1CreatePlacement(page, input);
  // Find the occurrence id for the placement via /v1/timeline.
  const tlRes = await page.request.get(
    `/api/proxy/v1/timeline?start=${encodeURIComponent(input.start)}&end=${encodeURIComponent(input.end)}`,
  );
  expect(tlRes.status()).toBeLessThan(400);
  const items = (await tlRes.json()) as V1TimelineItem[];
  const occ = items.find(
    (i) => (i.placementId ?? i.placement_id) === placementId,
  );
  if (!occ) throw new Error("no timeline item for placement " + placementId);
  const occurrenceId = occ.occurrenceKey ?? (occ.placementId ?? occ.placement_id)!;
  return { id: placementId, occurrenceId, tileId };
}

test.describe("quick tile — cell click + tile click edit/delete", () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test("clicking a day-view slot opens the create panel with the slot time preset", async ({ page }) => {
    const day = todayUtc();
    await page.goto(`/dashboard/calendar?view=day&anchor=${day}`);
    await page.getByTestId(`day-slot-${day}-14`).click();

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    // The submit button starts disabled because the title is empty.
    await expect(submit).toBeDisabled();
    // No delete button in create mode.
    expect(await page.getByTestId("quick-create-delete").count()).toBe(0);
  });

  test("clicking a tile opens the edit panel with delete available; submit PATCHes the event", async ({ page }) => {
    const day = todayUtc();
    const start = `${day}T10:00:00.000Z`;
    const end = `${day}T11:00:00.000Z`;
    const original = "Edit me " + Date.now();
    const updated = "Edited " + Date.now();
    const { id, occurrenceId } = await createEventViaApi(page, { title: original, start, end });

    await page.goto(`/dashboard/calendar?view=day&anchor=${day}`);
    // The tile is rendered as a button carrying the (possibly expanded) occurrence id.
    await page.getByTestId(`day-event-${occurrenceId}`).click();

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();
    // The delete button is only rendered in edit mode.
    const del = page.getByTestId("quick-create-delete");
    await expect(del).toBeVisible();
    // The title input is pre-filled with the original title.
    const titleInput = page.locator('input[aria-required="true"]').first();
    await expect(titleInput).toHaveValue(original);

    // Change the title and submit. The panel should PATCH /api/events/{id}
    // (not POST /v1/tiles) and close.
    // v1 edit fires: POST /v1/tiles/{tileId}/update + POST /v1/placements/{id}/changes.
    // We wait for the placement changes call as the panel's primary completion.
    const waitPatch = page.waitForResponse(
      (r) =>
        r.url().includes(`/v1/placements/${id}/changes`) &&
        r.request().method() === "POST",
    );
    await titleInput.fill(updated);
    await submit.click();
    const patchRes = await waitPatch;
    expect(patchRes.status()).toBeLessThan(400);

    // Panel closes on success.
    await expect(submit).not.toBeVisible();

    // Verify via the v1 timeline (read path), which now returns placement titles.
    const after = await page.request.get(
      `/api/proxy/v1/timeline?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    const afterData = (await after.json()) as Array<{ placementId?: string; placement_id?: string; content?: { title?: string } }>;
    const edited = (afterData ?? []).find(
      (i) => (i.placementId ?? i.placement_id) === id,
    );
    expect(edited?.content?.title).toBe(updated);
  });

  test("delete button removes the event", async ({ page }) => {
    const day = todayUtc();
    const start = `${day}T13:00:00.000Z`;
    const end = `${day}T14:00:00.000Z`;
    const title = "Delete me " + Date.now();
    const { id, occurrenceId } = await createEventViaApi(page, { title, start, end });

    await page.goto(`/dashboard/calendar?view=day&anchor=${day}`);
    await page.locator(`[data-tile-id="${occurrenceId}"]`).first().click();

    const del = page.getByTestId("quick-create-delete");
    await expect(del).toBeVisible();

    // Auto-accept the confirm() dialog.
    page.once("dialog", (d) => d.accept());
    const waitDel = page.waitForResponse(
      (r) =>
        r.url().includes(`/v1/placements/${id}/close`) &&
        r.request().method() === "POST",
    );
    await del.click();
    const delRes = await waitDel;
    expect(delRes.status()).toBeLessThan(400);

    // The panel closes on success.
    await expect(page.getByTestId("quick-create-submit")).not.toBeVisible();

    // The placement is gone from the v1 timeline.
    const after = await page.request.get(
      `/api/proxy/v1/timeline?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    const data = (await after.json()) as Array<{ placementId?: string; placement_id?: string }>;
    const ids = (data ?? []).map((i) => i.placementId ?? i.placement_id);
    expect(ids).not.toContain(id);
  });
});
