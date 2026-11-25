import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type Response } from "@playwright/test";

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "docs/evidence/2026-11-16-monthly-e2e",
);
const SCREENSHOT_DIR = resolve(EVIDENCE_DIR, "screenshots");

type MonthlyRule = {
  kind: number;
  day_of_month?: number;
  week_of_month?: number;
  weekday?: number;
};

type MonthlyGeneration = {
  kind: number;
  starts_at?: string;
  at?: string;
  interval_ms?: number;
  monthly_rule?: MonthlyRule | null;
};

type PublishRequest = {
  payload: {
    source_horizon: { start: string; end: string };
    source_schedule: {
      generation: MonthlyGeneration;
      monthly_rule?: unknown;
    };
    tile: { title: string };
  };
};

type PublishResponse = {
  aggregate_meta?: { source_tile_id?: string | null };
};

type SourceDetail = {
  source?: {
    schedule?: { generation?: MonthlyGeneration };
  };
  placements?: {
    items?: Array<{ start: string; end: string }>;
  };
};

const apiTrace: Array<Record<string, unknown>> = [];

test.afterEach(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(
    resolve(EVIDENCE_DIR, "api-trace.json"),
    `${JSON.stringify(apiTrace, null, 2)}\n`,
    "utf8",
  );
});

function jstDate(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function startMonthlyComposer(
  page: Page,
  title: string,
  startDate: string,
): Promise<void> {
  await page.goto("/dashboard/timeline/day");
  await page.getByTestId("sidebar-new-tile").first().click();
  await page.getByTestId("workflow-batch-recurring").click();
  await page.getByTestId("recurring-title").fill(title);

  const modes = page.getByTestId("recurring-mode-tabs");
  await expect(modes).toBeVisible();
  await modes
    .locator("label")
    .filter({ hasText: /Do not repeat|No repeat|繰り返さない/ })
    .click();
  const timeModel = page.getByTestId("recurring-time-model");
  await timeModel.locator("label").nth(1).click();
  const start = page.getByTestId("recurring-start-date");
  await expect(start).toBeVisible();
  await start.fill(startDate);
  await start.press("Tab");
  await expect(start).toHaveValue(startDate);
  await modes.locator("label").filter({ hasText: /Monthly|毎月|每月/ }).click();
  // Pick a schedulable time window so the worker can place each occurrence
  // during the day instead of competing with overnight seed placements.
  await timeModel.locator("label").nth(2).click();
  await page.getByTestId("recurring-schedulable-window-start").fill("09:00");
  await page.getByTestId("recurring-schedulable-window-start").press("Tab");
  await page.getByTestId("recurring-schedulable-window-end").fill("17:00");
  await page.getByTestId("recurring-schedulable-window-end").press("Tab");
  await expect(page.getByTestId("recurring-monthly-kind")).toBeVisible();
}

async function setRepeatEndDate(page: Page, date: string): Promise<void> {
  await page.getByTestId("recurring-end-toggle").locator("..").click();
  const input = page.getByTestId("recurring-end-date");
  await expect(input).toBeVisible();
  await input.fill(date);
  await input.press("Tab");
  await expect(input).toHaveValue(date);
}

async function setByDay(page: Page, dayOfMonth: number): Promise<void> {
  const kind = page.getByTestId("recurring-monthly-kind");
  await kind.locator("label").first().click();
  await page.getByTestId("recurring-monthly-day-of-month").fill(String(dayOfMonth));
}

async function setByWeekdayLastSunday(page: Page): Promise<void> {
  const kind = page.getByTestId("recurring-monthly-kind");
  await kind.locator("label").nth(1).click();

  await page.getByRole("combobox", { name: "週" }).click();
  await page.getByRole("option", { name: /Last|最終/ }).click();
  // The UI's default weekday is Sunday (index 0); the wire must map that
  // Sunday-first selector to Core's ISO weekday 7.
}

async function submitSchedule(page: Page): Promise<Response> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/proxy/v1/schedule-definitions") &&
      response.request().method() === "POST",
  );
  await page.getByTestId("quick-create-submit").click();
  return responsePromise;
}

function publishRequest(response: Response): PublishRequest {
  return response.request().postDataJSON() as PublishRequest;
}

async function readSourceDetail(
  page: Page,
  sourceTileId: string,
): Promise<SourceDetail> {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(`/api/proxy/v1/source-tiles/${id}`, {
      cache: "no-store",
    });
    return { status: response.status, body: await response.json() };
  }, sourceTileId);
  expect(result.status).toBe(200);
  return result.body as SourceDetail;
}

function placementDates(detail: SourceDetail): string[] {
  return (detail.placements?.items ?? [])
    .map((placement) => jstDate(placement.start))
    .sort();
}

async function writeScreenshot(page: Page, name: string): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, name),
    fullPage: true,
  });
}

async function createAndReadBack(
  page: Page,
  title: string,
  expectedRule: MonthlyRule,
): Promise<{ request: PublishRequest; sourceTileId: string; detail: SourceDetail }> {
  const response = await submitSchedule(page);
  const request = publishRequest(response);
  expect(response.status()).toBe(200);

  const generation = request.payload.source_schedule.generation;
  expect(generation.kind).toBe(3);
  expect(generation.monthly_rule).toEqual(expectedRule);
  expect(generation).not.toHaveProperty("at");
  expect(generation).not.toHaveProperty("interval_ms");
  expect(request.payload.source_schedule).not.toHaveProperty("monthly_rule");

  const responseBody = (await response.json()) as PublishResponse;
  const sourceTileId = responseBody.aggregate_meta?.source_tile_id;
  expect(sourceTileId).toBeTruthy();
  const detail = await readSourceDetail(page, sourceTileId as string);
  expect(detail.source?.schedule?.generation?.kind).toBe(3);
  expect(detail.source?.schedule?.generation?.monthly_rule).toEqual(expectedRule);

  apiTrace.push({
    title,
    status: response.status(),
    request: {
      generation,
      source_horizon: request.payload.source_horizon,
      source_schedule_has_top_level_monthly_rule: Object.hasOwn(
        request.payload.source_schedule,
        "monthly_rule",
      ),
    },
    response: {
      source_tile_id: sourceTileId,
      placement_dates_jst: placementDates(detail),
    },
  });
  return { request, sourceTileId: sourceTileId as string, detail };
}

test.describe("monthly recurrence through Web, Core, and PostgreSQL", () => {
  test("by-day 31 skips February and read-back survives reload", async ({ page }) => {
    const title = `monthly-e2e-day31-2027-${Date.now()}`;
    await startMonthlyComposer(page, title, "2027-01-01");
    await setByDay(page, 31);
    await setRepeatEndDate(page, "2027-04-05");
    await writeScreenshot(page, "monthly-by-day-31-form.png");

    const { sourceTileId, detail } = await createAndReadBack(page, title, {
      kind: 0,
      day_of_month: 31,
    });
    expect(placementDates(detail)).toEqual(["2027-01-31", "2027-03-31"]);

    await page.reload();
    await page.getByTestId("sidebar-new-tile").first().waitFor();
    const persisted = await readSourceDetail(page, sourceTileId);
    expect(placementDates(persisted)).toEqual(["2027-01-31", "2027-03-31"]);
    apiTrace.push({
      title,
      reload_readback_placement_dates_jst: placementDates(persisted),
    });
    await writeScreenshot(page, "monthly-after-reload.png");
  });

  test("by-day 29 materializes February 29 in a leap year", async ({ page }) => {
    const title = `monthly-e2e-leap-2028-${Date.now()}`;
    await startMonthlyComposer(page, title, "2028-01-01");
    await setByDay(page, 29);
    await setRepeatEndDate(page, "2028-04-05");
    await writeScreenshot(page, "monthly-leap-day-form.png");

    const { detail } = await createAndReadBack(page, title, {
      kind: 0,
      day_of_month: 29,
    });
    expect(placementDates(detail)).toEqual([
      "2028-01-29",
      "2028-02-29",
      "2028-03-29",
    ]);
  });

  test("last Sunday maps to ISO weekday 7 and reads back placements", async ({ page }) => {
    const title = `monthly-e2e-last-sunday-2027-${Date.now()}`;
    await startMonthlyComposer(page, title, "2027-01-01");
    await setByWeekdayLastSunday(page);
    await setRepeatEndDate(page, "2027-04-05");
    await writeScreenshot(page, "monthly-last-sunday-form.png");

    const { detail } = await createAndReadBack(page, title, {
      kind: 1,
      week_of_month: 5,
      weekday: 7,
    });
    expect(placementDates(detail)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-28",
    ]);
  });

  test("Core 422 is shown in the create panel", async ({ page }) => {
    const title = `monthly-e2e-invalid-${Date.now()}`;
    await startMonthlyComposer(page, title, "2027-01-01");
    await setByDay(page, 31);
    await page.route("**/api/proxy/v1/schedule-definitions", async (route) => {
      const request = route.request().postDataJSON() as PublishRequest;
      request.payload.source_schedule.generation.monthly_rule = {
        kind: 0,
        day_of_month: 32,
      };
      await route.continue({ postData: JSON.stringify(request) });
    });
    await writeScreenshot(page, "monthly-invalid-submit-form.png");

    const response = await submitSchedule(page);
    expect(response.status()).toBe(422);
    const alert = page.getByTestId("quick-create-panel").getByRole("alert");
    await expect(alert).toBeVisible();
    const errorText = (await alert.innerText()).trim();
    expect(errorText.length).toBeGreaterThan(0);
    await alert.scrollIntoViewIfNeeded();
    await expect(alert).toBeInViewport();
    await writeScreenshot(page, "monthly-invalid-422-error.png");

    apiTrace.push({
      title,
      status: response.status(),
      request: {
        generation: publishRequest(response).payload.source_schedule.generation,
      },
      response: { error_banner_visible: true, error_text: errorText },
    });
  });
});
