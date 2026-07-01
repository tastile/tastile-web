const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3000/dashboard/calendar', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  async function getState() {
    return await page.evaluate(() => {
      const slot = document.querySelector('[data-testid^="day-slot-"]');
      if (!slot) return { err: 'no slot' };
      let p = slot.parentElement;
      while (p) {
        const h = (p.getAttribute('style') || '').match(/height:\s*(\d+)px/);
        if (h && parseInt(h[1]) > 500) break;
        p = p.parentElement;
      }
      const rect = p.getBoundingClientRect();
      let sp = p.parentElement;
      while (sp) {
        const s = window.getComputedStyle(sp);
        if (/(auto|scroll|overlay)/.test(s.overflowY) && sp.scrollHeight > sp.clientHeight) break;
        sp = sp.parentElement;
      }
      const totalH = parseInt((p.getAttribute('style') || '').match(/height:\s*(\d+)px/)[1]);
      const spRect = sp?.getBoundingClientRect();
      return {
        hourHeight: totalH / 24,
        totalHeight: totalH,
        rect: { top: rect.top, height: rect.height },
        scrollTop: sp?.scrollTop ?? 0,
        scrollParentRect: spRect ? { top: spRect.top, height: spRect.height } : null,
      };
    });
  }

  async function dispatchCtrlWheel(clientX, clientY, deltaY) {
    return await page.evaluate(({ x, y, dy }) => {
      const slot = document.querySelector('[data-testid^="day-slot-"]');
      let p = slot.parentElement;
      while (p) {
        const h = (p.getAttribute('style') || '').match(/height:\s*(\d+)px/);
        if (h && parseInt(h[1]) > 500) break;
        p = p.parentElement;
      }
      p.dispatchEvent(new WheelEvent('wheel', {
        deltaY: dy, ctrlKey: true, bubbles: true, cancelable: true,
        clientX: x, clientY: y,
      }));
    }, { x: clientX, y: clientY, dy: deltaY });
  }

  // Pick a cursor Y well into the visible grid AND inside the scroll
  // viewport (so scrollTop adjustments are observable).
  const cursorX = 700;
  const cursorY = 700;

  // hour at cursor = cursor's distance below the grid top, divided by hourHeight.
  // The grid itself isn't a scroll container; the scrollParent just shifts where
  // the grid sits in the viewport. So measuring from `rect.top` (the grid's
  // viewport top) gives the right contentY in the grid's frame directly.
  const before = await getState();
  console.log('before:', before);
  const cursorRelBefore = cursorY - before.rect.top;
  const timeBefore = cursorRelBefore / before.hourHeight;
  console.log(`  cursorRel=${cursorRelBefore.toFixed(1)}, time=${timeBefore.toFixed(2)}h`);

  // Zoom in 3 ticks
  for (let i = 0; i < 3; i++) {
    await dispatchCtrlWheel(cursorX, cursorY, -100);
    await page.waitForTimeout(60);
  }
  const afterIn = await getState();
  const cursorRelAfterIn = cursorY - afterIn.rect.top;
  const timeAfterIn = cursorRelAfterIn / afterIn.hourHeight;
  console.log(`after zoom-in x3: cursorRel=${cursorRelAfterIn.toFixed(1)}, time=${timeAfterIn.toFixed(2)}h, hh=${afterIn.hourHeight}, scrollTop=${afterIn.scrollTop}, spRect.top=${afterIn.scrollParentRect?.top}`);
  const diffIn = Math.abs(timeAfterIn - timeBefore);
  console.log(`  Δtime = ${diffIn.toFixed(3)}h`, diffIn < 0.1 ? '✓ cursor-anchored' : '✗ DRIFTED');

  // Zoom out 3 ticks (mirrors the zoom-in magnitude). At default zoom (56)
  // hh 56 fits the 804px viewport when scrolling; the formula can't push
  // scrollTop negative, so we test the largest symmetric range here.
  for (let i = 0; i < 3; i++) {
    await dispatchCtrlWheel(cursorX, cursorY, 100);
    await page.waitForTimeout(60);
  }
  const afterOut = await getState();
  const cursorRelAfterOut = cursorY - afterOut.rect.top;
  const timeAfterOut = cursorRelAfterOut / afterOut.hourHeight;
  console.log(`after zoom-out x3: cursorRel=${cursorRelAfterOut.toFixed(1)}, time=${timeAfterOut.toFixed(2)}h, hh=${afterOut.hourHeight}, scrollTop=${afterOut.scrollTop}`);
  const diffOut = Math.abs(timeAfterOut - timeBefore);
  console.log(`  Δtime = ${diffOut.toFixed(3)}h`, diffOut < 0.1 ? '✓ cursor-anchored' : '✗ DRIFTED');

  // Heavy zoom-out (5 ticks) — when the grid becomes shorter than the
  // viewport, scrollTop can't go negative, so the cursor's hour MUST
  // drift. This is a physical limit, not a bug.
  for (let i = 0; i < 2; i++) {
    await dispatchCtrlWheel(cursorX, cursorY, 100);
    await page.waitForTimeout(60);
  }
  const afterHeavyOut = await getState();
  const timeHeavyOut = (cursorY - afterHeavyOut.rect.top) / afterHeavyOut.hourHeight;
  console.log(`after heavy zoom-out: hh=${afterHeavyOut.hourHeight}, time=${timeHeavyOut.toFixed(2)}h (drift expected when grid < viewport)`);

  console.log('--- Errors ---');
  console.log(errors.length === 0 ? 'NO ERRORS' : errors.join('\n'));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });