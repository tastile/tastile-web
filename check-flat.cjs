const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1570, height: 1478 } });
  await page.request.get('http://localhost:3000/api/events');
  await page.goto('http://localhost:3000/dashboard/calendar?view=day');
  await page.getByTestId('sidebar-new-tile').first().click();
  const submit = page.getByTestId('quick-create-submit');
  await submit.waitFor({ state: 'visible', timeout: 5000 });
  const completionBtn = page.locator('button').filter({ hasText: '完了条件' }).filter({ hasNotText: '完了条件と繰り返し' }).first();
  await completionBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify-condition-editor.png', clip: { x: 950, y: 0, width: 620, height: 800 } });
  console.log('saved verify-condition-editor.png');
  await browser.close();
})();
