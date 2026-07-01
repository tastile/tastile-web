import { test } from '@playwright/test';
import { v1CreateWeeklyRecurring, truncateV1 } from './helpers/v1';

test('debug materialize body', async ({ page }) => {
  test.setTimeout(60_000);
  await truncateV1();

  const today = new Date();
  const dow = today.getDay();
  const daysToMon = ((1 - dow) + 7) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMon, 12, 0, 0, 0);
  const anchorStart = monday.toISOString();
  const anchorEnd = new Date(monday.getTime() + 60 * 60 * 1000).toISOString();
  const mask = (1 << 0) | (1 << 1);

  // First create a tile + frame-rule
  const tileRes = await page.request.post('/api/proxy/v1/tiles', {
    headers: { 'content-type': 'application/json' },
    data: { idempotency_key: crypto.randomUUID(), payload: { kind: 0, title: 'dbg', description: null, color: '#3b82f6', icon: 'check', external_id: null, plan_role: 0, owner_subject_id: null } },
  });
  const tileBody = await tileRes.text();
  process.stdout.write('=== tileRes status:' + tileRes.status() + ' body:' + tileBody + '\n');
  const tile = JSON.parse(tileBody);
  const tileId = tile.aggregate?.id;

  const frameRuleId = crypto.randomUUID();
  const ruleRes = await page.request.post(`/api/proxy/v1/recurring/${tileId}/frame-rules`, {
    headers: { 'content-type': 'application/json' },
    data: { idempotency_key: crypto.randomUUID(), payload: { recurring_id: tileId, rule: { id: frameRuleId, active: null, rank: 0, generator: { Step: { step: 86_400_000, origin: null, bounds: null } } } } },
  });
  process.stdout.write('=== ruleRes status:' + ruleRes.status() + '\n');

  // Now materialize with explicit body and inspect response.
  const matBody = {
    idempotency_key: crypto.randomUUID(),
    payload: {
      recurring_id: tileId,
      frame_rule_id: frameRuleId,
      range_start: anchorStart,
      range_end: anchorEnd,
    },
  };
  const matRes = await page.request.post(
    `/api/proxy/v1/recurring/${tileId}/frame-rules/${frameRuleId}/materialize`,
    { headers: { 'content-type': 'application/json' }, data: matBody },
  );
  const matText = await matRes.text();
  process.stdout.write('=== mat1 status:' + matRes.status() + ' body:' + matText + '\n');

  // Second materialize with different range (next day)
  const matBody2 = {
    idempotency_key: crypto.randomUUID(),
    payload: {
      recurring_id: tileId,
      frame_rule_id: frameRuleId,
      range_start: new Date(monday.getTime() + 86_400_000).toISOString(),
      range_end: new Date(monday.getTime() + 86_400_000 + 60 * 60 * 1000).toISOString(),
    },
  };
  const matRes2 = await page.request.post(
    `/api/proxy/v1/recurring/${tileId}/frame-rules/${frameRuleId}/materialize`,
    { headers: { 'content-type': 'application/json' }, data: matBody2 },
  );
  const matText2 = await matRes2.text();
  process.stdout.write('=== mat2 status:' + matRes2.status() + ' body:' + matText2 + '\n');
});
