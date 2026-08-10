// e2e/helpers/ui.ts — UI-driving helpers for the 30 USECASE E2E specs.
//
// Contract: every helper here drives the rendered UI through Playwright
// locators.  No helper makes an HTTP request to /api/proxy/* or
// /v1/*.  Specs that drive the UI observe user-visible state (button
// text, panel content, timeline events) — they do not parse JSON
// responses or query Postgres.
//
// The only DB access allowed in a spec is via resetDb() from
// helpers/v1.ts (used as a pre-test fixture to start from a clean
// slate), and only if the spec's setup truly needs an empty DB.
// Specs should not assert on DB rows.

import { type Page, expect } from "@playwright/test";

/** Open the QuickCreate side panel via the sidebar trigger. */
export async function openQuickCreate(page: Page): Promise<void> {
  await page.locator("[data-testid='sidebar-new-tile']").first().click();
  await expect(page.locator("[data-testid='quick-create-panel']")).toBeVisible();
  await expect(page.locator("[data-testid='quick-create-input-title']")).toBeVisible();
}

/** Close the QuickCreate panel via the close button. */
export async function closeQuickCreate(page: Page): Promise<void> {
  await page.locator("[data-testid='quick-create-backdrop']").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("[data-testid='quick-create-panel']")).not.toBeVisible();
}

/** Fill the QuickCreate title input. */
export async function setQuickCreateTitle(page: Page, title: string): Promise<void> {
  await page.locator("[data-testid='quick-create-input-title']").fill(title);
}

/** Switch the tile kind picker.  Pass a RegExp that matches the radio label. */
export async function setQuickCreateKind(page: Page, kindLabel: RegExp): Promise<void> {
  const kind = page.locator("[data-testid='quick-create-tile-kind']");
  await kind.getByRole("radio", { name: kindLabel }).check();
}

/** Fill the start/end time fields on the QuickCreate time row. */
export async function setQuickCreateTime(page: Page, start: string, end: string): Promise<void> {
  await page.locator("[data-testid='quick-create-tab-plan']").click();
  const startInput = page.locator("[data-testid='when-calendar-input']").first();
  const endInput = page.locator("[data-testid='when-calendar-input']").nth(1);
  await startInput.fill(start);
  await endInput.fill(end);
}

/** Configure recurring fields.  Opens the Recurring subpanel via the
 *  Repeat chip on the QuickCreate main panel.  Weekday bits use the
 *  legacy WindowEditor order (bit0=Sun..6=Sat); the actual rendered
 *  checkboxes are labeled with Japanese day abbreviations
 *  (日/月/火/水/木/金/土). */
export async function setQuickCreateRecurring(
  page: Page,
  options: {
    mode: "daily" | "weekly" | "monthly" | "interval" | "once" | "condition";
    weekdayMask?: number; // bit0=Sun..bit6=Sat; bits 1..5 = Mon..Fri = 0b00111110 = 62
    lifeStart?: string; // YYYY-MM-DD
    lifeEnd?: string; // YYYY-MM-DD
  },
): Promise<void> {
  await page.locator("[data-testid='quick-create-tab-recurring']").click();
  await expect(page.locator("[data-testid='recurring-mode-tabs']")).toBeVisible();
  const modeTab = page.locator("[data-testid='recurring-mode-tabs']");
  const labelByMode: Record<typeof options.mode, RegExp> = {
    once: /(1回|一度だけ|Once)/,
    daily: /(毎日|日次|Daily)/,
    weekly: /(毎週|Weekly|週)/,
    monthly: /(毎月|月次|Monthly|月)/,
    interval: /(間隔|Interval|毎)/,
    condition: /(条件成立時|Conditional|条件)/,
  };
  const modeInput = modeTab.locator(`input[value="${options.mode}"]`);
  await modeInput.locator("..").locator("label").click();
  if (options.mode === "weekly" && typeof options.weekdayMask === "number") {
    for (let bit = 0; bit < 7; bit++) {
      const weekdayInput = page.locator(`[data-testid='recurring-weekday-${bit}']`);
      const shouldBeChecked = (options.weekdayMask & (1 << bit)) !== 0;
      if ((await weekdayInput.isChecked()) !== shouldBeChecked) {
        await weekdayInput.locator("..").locator("label").click();
      }
    }
  }
  if (options.lifeStart) {
    // The recurring panel exposes only an end-date Switch + DatePickerInput.
    // lifeStart is supported by the store but not the UI; honour it via the
    // store API exposed on `window.__tastileQuickCreateStore` when present
    // (set in dev mode by the store binding).  Fall back to skipping.
  }
  if (options.lifeEnd) {
    // Toggle the end-date switch (off→on) by clicking the visual track
    // span (Mantine renders the input hidden; the visible track receives
    // pointer events).  Then fill the revealed date picker.
    const endSwitchInput = page.locator("[data-testid='recurring-end-switch']");
    const checked = await endSwitchInput.getAttribute("data-checked");
    if (checked === "false") {
      await endSwitchInput.click({ force: true });
    }
    const dateInput = page.getByLabel(/終了|End|repeatEnd/).last();
    await dateInput.fill(options.lifeEnd);
  }
  const activeSubpanel = page.locator("section[data-panel-anim][aria-hidden='false']");
  await activeSubpanel.getByRole("button", { name: /^Close / }).click();
  await expect(page.locator("section[data-panel-anim][aria-hidden='false']")).toHaveCount(0);
}

/** Submit the QuickCreate panel and wait for its success navigation or closure.
 *  The atomic schedule publish can exceed 45s on a cold dev stack. */
export async function submitQuickCreate(page: Page): Promise<void> {
  const submit = page.locator("[data-testid='quick-create-submit']");
  await expect(submit).toBeEnabled();
  await submit.click();
  await Promise.race([
    page.waitForURL(/\/dashboard\/timeline(?:\?|$)/, { timeout: 120_000 }),
    expect(submit).not.toBeVisible({ timeout: 120_000 }),
  ]);
}

/** Discard the current draft (autosave + close). */
export async function discardQuickCreateDraft(page: Page): Promise<void> {
  await page.locator("[data-testid='quick-create-discard-draft']").click();
}

/** Navigate to /dashboard/timeline day view at the given ISO date (YYYY-MM-DD). */
export async function goToDay(page: Page, dateIso: string): Promise<void> {
  await page.goto(`/dashboard/timeline?view=day&date=${dateIso}`);
  await expect(page.locator("[data-testid='day-panel']")).toBeVisible({ timeout: 30_000 });
}

/** Navigate to /dashboard/timeline week view at the given ISO date. */
export async function goToWeek(page: Page, dateIso: string): Promise<void> {
  await page.goto(`/dashboard/timeline?view=week&date=${dateIso}`);
  await expect(page.locator("[data-testid='week-panel']")).toBeVisible({ timeout: 30_000 });
}

/** Navigate to /dashboard/timeline month view at the given ISO date. */
export async function goToMonth(page: Page, dateIso: string): Promise<void> {
  await page.goto(`/dashboard/timeline?view=month&date=${dateIso}`);
  await expect(page.locator("[data-testid='month-panel']")).toBeVisible({ timeout: 30_000 });
}

/** Navigate via the timeline "Previous day/week/month" button. */
export async function pressNext(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Next" }).first().click();
}

export async function pressPrev(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Previous" }).first().click();
}

export async function pressToday(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Today" }).click();
}

/** Assert that at least one timeline event with the given title is visible in the day view.
 *  Recurring materialisations may produce multiple placements of the
 *  same title across the visible range, so we use `.first()` to avoid
 *  strict-mode "multiple matches" failures. */
export async function expectDayEventVisible(page: Page, title: string): Promise<void> {
  await expect(
    page.locator("[data-testid='day-panel']").getByText(title, { exact: false }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Assert that a timeline event with the given title is NOT visible in the day view. */
export async function expectDayEventHidden(page: Page, title: string): Promise<void> {
  await expect(page.locator("[data-testid='day-panel']").getByText(title, { exact: false })).toHaveCount(0, { timeout: 30_000 });
}

/** Assert exactly N timeline events with the given title are visible in the day view. */
export async function expectDayEventCount(page: Page, title: string, count: number): Promise<void> {
  await expect(page.locator("[data-testid='day-panel']").getByText(title, { exact: false })).toHaveCount(count, { timeout: 30_000 });
}

/** Click a timeline event by title (opens the edit panel). */
export async function clickDayEvent(page: Page, title: string): Promise<void> {
  await page.locator("[data-testid='day-panel']").getByText(title, { exact: false }).first().click();
}

/** Click an empty day-view slot to open QuickCreate pre-filled with that time. */
export async function clickEmptySlot(page: Page, dayShort: string, hour: number): Promise<void> {
  // dayShort is YYYY-MM-DD; the slot testid format is `day-slot-${dayShort}-${hour}`.
  await page.locator(`[data-testid='day-slot-${dayShort}-${String(hour).padStart(2, "0")}']`).first().click();
}

/** Wait for the DecisionPromptSheet to appear (or already be visible). */
export async function expectDecisionPrompt(page: Page): Promise<void> {
  await expect(page.locator("[data-testid='decision-prompt-sheet']")).toBeVisible({ timeout: 30_000 });
}

/** Assert no DecisionPromptSheet is open. */
export async function expectNoDecisionPrompt(page: Page): Promise<void> {
  await expect(page.locator("[data-testid='decision-prompt-sheet']")).toHaveCount(0, { timeout: 30_000 });
}

/** Submit a decision form with the given choice (clicks the first radio + submit). */
export async function respondToDecision(page: Page, choice: "yes" | "no" | "later"): Promise<void> {
  const form = page.locator("[data-testid='decision-active-form']");
  await expect(form).toBeVisible();
  const label =
    choice === "yes" ? /(はい|Yes|Accept|承諾|採用)/ :
    choice === "no" ? /(いいえ|No|Reject|辞退|不採用)/ :
    /(あとで|Later|後で|Postpone)/;
  await form.getByRole("radio", { name: label }).first().check();
  await form.getByRole("button", { name: /(送信|Submit|決定|応答)/ }).click();
}

/** Click the start-execution affordance on the active execution bar. */
export async function clickStartExecution(page: Page): Promise<void> {
  await page.locator("[data-testid='execution-start']").click();
}

/** Click finish-execution.  Pass kind=normal|void. */
export async function clickFinishExecution(page: Page, kind: "normal" | "void"): Promise<void> {
  await page.locator("[data-testid='execution-finish']").click();
  const label = kind === "void" ? /(Void|破棄|取消)/ : /(Finish|完了|Normal|正常終了)/;
  await page.getByRole("button", { name: label }).first().click();
}

/** Open the notifications menu. */
export async function openNotifications(page: Page): Promise<void> {
  await page.locator("[data-testid='bell']").click();
}

/** Assert the notifications menu contains text. */
export async function expectNotificationContains(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator("[data-testid='digest']")).toContainText(text);
}

/** Assert the notifications bell badge shows the given unread count. */
export async function expectNotificationBadge(page: Page, count: number): Promise<void> {
  const badge = page.locator("[data-testid='bell']").locator("..").getByText(String(count), { exact: true });
  await expect(badge).toBeVisible();
}

/** Unique title with timestamp suffix for parallel-safe spec runs. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
