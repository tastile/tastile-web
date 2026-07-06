import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents(_page: Page) { // eslint-disable-line @typescript-eslint/no-unused-vars
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

test.describe('quick tile - end-to-end create to timeline render', () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test('panel sidebar create -> day view shows the tile in the timeline', async ({ page }) => {
    const title = 'sidebar-to-timeline-' + Date.now();
    const day = todayUtc();
  const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000) // eslint-disable-line @typescript-eslint/no-unused-vars
    .toISOString()
    .slice(0, 10);
  const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000) // eslint-disable-line @typescript-eslint/no-unused-vars
    .toISOString()
    .slice(0, 10);

    // 1) Open sidebar, click the New tile button, fill the form, submit.
    await page.goto('/dashboard/calendar?view=day');
    await page.getByTestId('sidebar-new-tile').first().click();
    const submit = page.getByTestId('quick-create-submit');
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.locator('input[aria-required=true]').first().fill(title);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(submit).not.toBeVisible();

    // 2) The day view must render the tile. We wait for the day-view
    // occurrence refetch to complete (notifyEventsChanged is fired by
    // the panel after create) and then assert the tile is in the DOM.
    const dayTile = page.locator('[data-testid^="day-event-"], [data-event-id]', { hasText: title }).first();
    await expect(dayTile).toBeVisible({ timeout: 10_000 });
  });
});
