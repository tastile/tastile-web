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

test.describe("TaskDefinition round-trip e2e", () => {
  test.beforeEach(async () => {
    await deleteAllEvents();
  });

  test("two tasks appear in submit payload and persist to DB", async ({ page }) => {
    const title = "TaskDef E2E " + Date.now();
    await page.goto("/dashboard/calendar?view=day");

    await page.getByTestId("sidebar-new-tile").first().click();
    await page.locator('input[aria-required="true"]').first().fill(title);

    const addTaskBtn = page.getByTestId("add-task-button");
    await expect(addTaskBtn).toBeVisible();
    await addTaskBtn.click();

    const taskRows = page.getByTestId("task-row");
    await expect(taskRows).toHaveCount(2);

    const titleInputs = page.getByTestId("task-title-input");
    await titleInputs.nth(0).fill("First task");
    await titleInputs.nth(1).fill("Second task");

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
    expect(matching!.tileId).toBeTruthy();

    const plan = await queryPlanCompletion(matching!.tileId!);
    expect(plan).not.toBeNull();
    const completion = plan!.completion as Record<string, unknown> | undefined;
    expect(completion).toBeTruthy();

    const tasks = completion!.tasks as Array<Record<string, unknown>> | undefined;
    expect(tasks).toBeDefined();
    expect(tasks!.length).toBeGreaterThanOrEqual(2);

    const titles = tasks!.map((t) => (t.content as Record<string, unknown>).title as string);
    expect(titles).toContain("First task");
    expect(titles).toContain("Second task");
  });

  test("task complete condition round-trips via API", async ({ page }) => {
    const title = "TaskCond E2E " + Date.now();
    await page.goto("/dashboard/calendar?view=day");

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
    const plan = await queryPlanCompletion(tileId);
    expect(plan).not.toBeNull();

    const completion = plan!.completion as Record<string, unknown>;
    const tasks = completion!.tasks as Array<Record<string, unknown>>;
    expect(tasks).toBeDefined();
    expect(tasks!.length).toBeGreaterThan(0);

    const firstTask = tasks![0] as Record<string, unknown>;
    expect(firstTask.complete).toBeDefined();
    expect(firstTask.complete).not.toBeNull();
  });
});
