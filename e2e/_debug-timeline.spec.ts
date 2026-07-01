import { test } from '@playwright/test';
import { v1CreateWeeklyRecurring, truncateV1 } from './helpers/v1';

test('debug timeline fetch', async ({ page }) => {
  test.setTimeout(60_000);
  await truncateV1();

  const today = new Date();
  const dow = today.getDay();
  const daysToMon = ((1 - dow) + 7) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMon, 12, 0, 0, 0);
  const anchorStart = monday.toISOString();
  const anchorEnd = new Date(monday.getTime() + 60 * 60 * 1000).toISOString();
  const mask = (1 << 0) | (1 << 1);

  const result = await v1CreateWeeklyRecurring(page, {
    title: 'debug-weekly-2',
    anchorStart,
    anchorEnd,
    weekdayMaskV1: mask,
    timeOfDay: { start: '12:00', end: '13:00' },
    occurrences: 4,
  });
  // Pretty print
  const pids = JSON.stringify(result.placementIds);
  const tid = result.tileId;
  const frid = result.frameRuleId;
  process.stdout.write('=== placementIds:' + pids + '\n');
  process.stdout.write('=== tileId:' + tid + '\n');
  process.stdout.write('=== frameRuleId:' + frid + '\n');
  process.stdout.write('=== length:' + result.placementIds.length + '\n');
});
