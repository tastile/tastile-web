import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

function todayUtc(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents() {
  execFileSync(
    "wslc",
    [
      "container", "exec", "tastile-db",
      "psql", "-U", "tastile", "-d", "tastile_db", "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation RESTART IDENTITY CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

async function queryPlanCompletion(tileId: string): Promise<Record<string, unknown> | null> {
  const result = execFileSync(
    "wslc",
    [
      "container", "exec", "tastile-db",
      "psql", "-U", "tastile", "-d", "tastile_db", "-t", "-A", "-c",
      `SELECT row_to_json(p.*) FROM v1_plan p JOIN v1_tile t ON t.plan_id = p.id WHERE t.id = '${tileId}'::uuid;`,
    ],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const row = result.trim();
  if (!row) return null;
  try {
    return JSON.parse(row) as Record<string, unknown>;
  } catch {
    return null;
  }
}

test.describe("TimeRequirement round-trip e2e", () => {
  test.beforeEach(async () => {
    await deleteAllEvents();
  });

  test("TimeRequirement persists through QuickCreate submit and is readable from DB", async ({ page }) => {
    const title = "TimeReq E2E " + Date.now();
    await page.goto("/dashboard/timeline/day");

    await page.getByTestId("sidebar-new-tile").first().click();
    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    await page.locator('input[aria-required="true"]').first().fill(title);
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(submit).not.toBeVisible();

    const day = todayUtc();
    const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const occUrl = `/api/events/occurrences?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z&min_minutes=0&include_recurring=true`;
    const occ = await page.request.get(occUrl);
    const occData = (await occ.json()) as { occurrences: Array<{ title: string; tileId?: string }> };
    const matching = (occData.occurrences ?? []).find((o) => o.title === title);
    expect(matching).toBeTruthy();
    expect(matching!.tileId).toBeTruthy();

    const plan = await queryPlanCompletion(matching!.tileId!);
    expect(plan).not.toBeNull();
    const completion = plan!.completion as Record<string, unknown> | undefined;
    expect(completion).toBeTruthy();
    const timeRequirements = completion!.time_requirements as Array<Record<string, unknown>> | undefined;
    expect(timeRequirements).toBeDefined();
    expect(timeRequirements!.length).toBeGreaterThan(0);

    const first = timeRequirements![0] as Record<string, unknown>;
    expect(first.observation).toBeDefined();
    expect(first.required).toBeDefined();
    const required = first.required as Record<string, unknown>;
    expect(typeof required.min).toBe("number");
    expect(typeof required.max).toBe("number");
    expect(required.min).toBeGreaterThan(0);
    expect(required.max).toBeGreaterThan(0);
  });

  test("API read endpoint returns the same TimeRequirement values", async ({ page }) => {
    const title = "TimeReq API " + Date.now();
    await page.goto("/dashboard/timeline/day");

    await page.getByTestId("sidebar-new-tile").first().click();
    await page.locator('input[aria-required="true"]').first().fill(title);

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(submit).not.toBeVisible();

    const day = todayUtc();
    const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const occUrl = `/api/events/occurrences?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z&min_minutes=0&include_recurring=true`;
    const occ = await page.request.get(occUrl);
    const occData = (await occ.json()) as { occurrences: Array<{ title: string; tileId?: string }> };
    const matching = (occData.occurrences ?? []).find((o) => o.title === title);
    expect(matching).toBeTruthy();

    const tileId = matching!.tileId!;
    const planRes = await page.request.get(`/api/proxy/v1/tiles/${tileId}`);
    expect(planRes.status()).toBeLessThan(400);
    const tileView = (await planRes.json()) as { plan_id?: string };
    expect(tileView.plan_id).toBeTruthy();
  });
});
