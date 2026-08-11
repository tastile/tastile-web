import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents(_page: Page) { 
  // /api/events is now 410 (v0 removed).  Wipe the v1 placement+plan rows
  // directly via docker exec so the day view is fully empty for the next test.
  execFileSync(
    'docker',
    [
      'exec', 'tastile-core-db-1',
      'psql', '-U', 'tastile', '-d', 'tastile_db', '-c',
      'TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;',
    ],
    { stdio: 'ignore' },
  );
}

interface V1CommandResp { aggregate?: { id: string }; }
interface V1TileView { id: string; planId?: string | null; plan_id?: string | null; }

async function v1CreatePlacement(
  page: Page,
  body: { title: string; start: string; end: string },
): Promise<{ tileId: string; planId: string; placementId: string }> {
  const tileRes = await page.request.post("/api/proxy/v1/tiles", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        kind: 1, // PLACEMENT
        title: body.title,
        description: null,
        color: "#3b82f6",
        icon: "check-circle",
        external_id: null,
        plan_role: 0,
        owner_subject_id: null,
      },
    },
  });
  expect(tileRes.status(), `POST /v1/tiles: ${tileRes.status()}`).toBeLessThan(400);
  const tile = (await tileRes.json()) as V1CommandResp;
  const tileId = tile.aggregate?.id;
  if (!tileId) throw new Error("v1/tiles response missing aggregate.id");

  const tileViewRes = await page.request.get(`/api/proxy/v1/tiles/${tileId}`);
  expect(tileViewRes.status()).toBeLessThan(400);
  const tileView = (await tileViewRes.json()) as V1TileView;
  const planId = tileView.planId ?? tileView.plan_id ?? null;
  if (!planId) throw new Error("v1 tile " + tileId + " has no plan_id");

  const placementRes = await page.request.post("/api/proxy/v1/placements", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        tile_id: tileId,
        plan_id: planId,
        source: 0,
        source_ref: {
          created: null, recurring: null, flow: null,
          frame: null, proposal: null, source_text: null, external_id: null,
        },
        baseline: {
          span: { start: body.start, end: body.end },
          inside: null,
        },
      },
    },
  });
  expect(placementRes.status(), `POST /v1/placements: ${placementRes.status()}`).toBeLessThan(400);
  const placement = (await placementRes.json()) as V1CommandResp;
  const placementId = placement.aggregate?.id;
  if (!placementId) throw new Error("v1/placements response missing aggregate.id");
  return { tileId, planId, placementId };
}

async function createEvent(
  page: Page,
  body: Record<string, unknown> & { title: string; start: string; end: string },
) {
  const { placementId } = await v1CreatePlacement(page, body);
  return { event: { id: placementId, title: body.title } };
}

test.describe('quick tile - day view timeline display', () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test('placement tile appears in the day view timeline DOM', async ({ page }) => {
    const title = 'timeline-tile-' + Date.now();
    const day = todayUtc();
    await createEvent(page, {
      title,
      description: null,
      location: null,
      start: day + 'T10:00:00.000Z',
      end: day + 'T11:00:00.000Z',
      allDay: false,
      color: 'blue',
      recurrence: { frequency: 'none' },
      attendees: [],
      icon: null,
      project: null,
      tags: [],
      memo: null,
    });

    await page.goto('/dashboard/timeline/day');
    const tile = page.locator('[data-event-id], [data-testid^="day-event-"]', { hasText: title }).first();
    await expect(tile).toBeVisible();
  });

  test('all-day placement tile appears in the day view all-day lane', async ({ page }) => {
    const title = 'allday-tile-' + Date.now();
    const day = todayUtc();
    await createEvent(page, {
      title,
      description: null,
      location: null,
      start: day + 'T00:00:00.000Z',
      end: day + 'T23:59:59.000Z',
      allDay: true,
      color: 'blue',
      recurrence: { frequency: 'none' },
      attendees: [],
      icon: null,
      project: null,
      tags: [],
      memo: null,
    });

    await page.goto('/dashboard/timeline/day');
    const tile = page.locator('[data-event-id], [data-testid^="day-event-"]', { hasText: title }).first();
    await expect(tile).toBeVisible();
  });
});
