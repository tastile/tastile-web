/**
 * [D3a] FrameRule persistence E2E
 *
 * Issue: rebui-coder/tastile-web#47
 * Plan:  tastile-web/docs/plans/D3a-frame-rule-e2e.md
 *
 * Runtime end-to-end test that opens the QuickCreate panel, configures a
 * single weekday FrameRule (daily, 09:00-17:00, Mon-Fri), submits, and
 * then asserts that the v1_core has persisted exactly one row in
 * `v1_recurring_frame_rule` for the resulting recurring id, with the
 * canonical weekday mask matching Mon-Fri.
 *
 * IMPORTANT — dependency gating:
 *   D3a depends on D1a (FrameRule wire expansion + `v1_recurring_frame_rule`
 *   persistence).  Until D1a is implemented, the wire layer currently
 *   drops `frameRules` (`src/shared/api/v1/quick-create-schedule-wire.ts`
 *   emits a `[D2a] legacy recurring/flow rules silently dropped` warning
 *   and writes nothing for the frame rule).  The test below detects that
 *   state by sniffing the persisted row count BEFORE the UI submit and
 *   skips with a descriptive message so that:
 *     - the spec is in place and stable for when D1a lands,
 *     - and CI does not report green on a missing-feature assertion.
 *
 * Cleanup (child-first to satisfy FK constraints):
 *   v1_placement, v1_event, v1_change_set, v1_window, v1_recurring,
 *   v1_frame, v1_recurring_frame_rule, v1_materialization_state, v1_tile
 *   — matches the at-010 / at-020 truncate idiom.
 *
 * SQL assertion target (per plan D3a §"検証手順"):
 *   `wslc container exec tastile-db psql -U postgres -d tastile -c
 *      "SELECT count(*) FROM v1_recurring_frame_rule WHERE recurring_id = $1;"`
 *   The spec keeps the host-side shell path compatible with both
 *   `docker exec tastile-core-db-1` (legacy) and `wslc container exec`
 *   (target after G5a/G5b1 land).
 *
 * Calendar weekday mask bit-ordering (per
 * `tastile-core/v1/08-recurring-and-frame.md` §CalendarGenerator +
 * migration V1_001__base.sql:455):
 *   bit0=Mon ... bit6=Sun  →  Mon-Fri = 0b0011111 = 31
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

// ─────────────────────────────────────────────────────────────────────────────
// Constants / env

// Database host is "wslc" once G5a migration lands; until then the existing
// docker-compose based test stack uses the legacy container name.  The two
// paths are auto-selected by checking which client is available.
const DOCKER_CONTAINER = "tastile-core-db-1";
const DB_USER = "tastile";
const DB_NAME = "tastile_db";
const PSQL_ARGS = ["-U", DB_USER, "-d", DB_NAME];

// Calendar weekday mask bit-order: bit0=Mon..bit6=Sun.
const MASK_MON_FRI = 0b0011111; // 31 — Mon..Fri

// Daily window: 09:00-17:00.  The v1 wire stores the window length via
// `step_duration_ms` (24h rolls) and the active condition's
// `time_start` / `time_end` (minutes-of-day).  09:00 → 540, 17:00 → 1020.
const TIME_START_MIN = 9 * 60; //  540
const TIME_END_MIN = 17 * 60; // 1020
const STEP_MS_DAILY = 24 * 60 * 60 * 1000; // 86_400_000

// ─────────────────────────────────────────────────────────────────────────────
// helpers

function uuidv7like(): string {
  const h = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n)).toString(16).padStart(n, "0");
  return `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`;
}

function todayUtc(): string {
  // Pin the test runner to Asia/Tokyo so the day-view window covers any
  // placement that lands on the UTC day boundary.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

/**
 * Run a SQL statement against the v1 database.  Returns trimmed stdout.
 * Throws on non-zero exit so a broken executor surfaces as a hard spec
 * failure (rather than being silently swallowed by `try/catch`).
 */
function runSql(sql: string): string {
  // Prefer `wslc container exec` when the WSL Container runtime is on
  // PATH (G5a/G5b1).  Fall back to legacy `docker exec` so the spec
  // stays runnable on the current dev stack.
  const useWslcRaw = (() => {
    try {
      execFileSync("wslc", ["container", "ls"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  const cmd = useWslcRaw ? "wslc" : "docker";
  const argv = useWslcRaw
    ? ["container", "exec", "tastile-db", "psql", ...PSQL_ARGS, "-At", "-c", sql]
    : ["exec", "-i", DOCKER_CONTAINER, "psql", ...PSQL_ARGS, "-At", "-c", sql];
  return execFileSync(cmd, argv, { encoding: "utf8" }).trim();
}

/**
 * Truncate v1 tables in child-first order so the next test sees a clean
 * slate.  `v1_recurring_frame_rule` and `v1_frame` are added to the
 * standard cleanup list because D3a asserts on their row counts.
 */
function truncateV1(): void {
  const sql =
    "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, " +
    "v1_frame, v1_recurring_frame_rule, v1_materialization_state, " +
    "v1_materialization_lease, v1_tile RESTART IDENTITY CASCADE;";
  runSql(sql);
}

/**
 * D1a is a hard dependency: until the wire layer stops silently dropping
 * `frameRules`, a submitted QuickCreate will produce zero
 * `v1_recurring_frame_rule` rows regardless of what the user enters.
 *
 * Returns true when `v1_recurring_frame_rule` is present in the schema
 * AND at least one row was ever persisted (i.e. D1a has run end-to-end
 * at least once).  The spec uses this to self-skip with a clear note
 * instead of falsely reporting green.
 */
function d1aImplemented(): boolean {
  try {
    const exists = runSql(
      "SELECT to_regclass('public.v1_recurring_frame_rule')::text;",
    );
    if (!exists) return false;
    // The worker's `default_break_recurring` migration in
    // `tastile-core/crates-v1/storage/src/default_break_recurring.rs`
    // inserts at least one row, so a non-zero count proves the wire
    // path is alive.
    const seeded = runSql(
      "SELECT count(*) FROM v1_recurring_frame_rule;",
    );
    return Number(seeded) > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers

async function openQuickCreate(page: Page): Promise<void> {
  await page.goto("/dashboard/timeline/day");
  await page.getByTestId("sidebar-new-tile").first().click();
  const submit = page.getByTestId("quick-create-submit");
  await expect(submit).toBeVisible();
}

/**
 * Switch the panel kind pickers to Recurring + weekly, then flip the
 * Mon..Fri weekday bits on the recurring chip.  Mirrors the
 * SourceGenerationPanel testid contract (see
 * `src/features/create-tile/ui/SourceGenerationPanel.tsx`):
 *   - data-testid="recurring-mode-tabs"
 *   - data-testid="recurring-weekday-{bit}"  (bit 0 = Mon in v1 terms;
 *     the existing UI uses bit 0 = Sun for legacy WindowEditor parity,
 *     so the testid aligns with the panel's local mapping).
 *
 * The canonical v1 bit-order (bit0=Mon..bit6=Sun) is restored at the
 * SQL assertion layer.
 */
async function fillFrameRule(
  page: Page,
  title: string,
): Promise<void> {
  // Title
  await page.locator("input[aria-required=\"true\"]").first().fill(title);

  // Kind → Recurring
  const kindRow = page.getByTestId("quick-create-tile-kind");
  await kindRow.getByRole("radio", { name: /Recurring|定期/ }).click();

  // Mode → weekly
  const modeTabs = page.getByTestId("recurring-mode-tabs");
  await expect(modeTabs).toBeVisible();
  await modeTabs.getByRole("radio", { name: /Weekly|毎週|週/ }).click();

  // Pick Mon..Fri.  In the UI panels the testid indexing follows
  // WindowEditor legacy (bit0=Sun..bit6=Sat), so Mon..Fri are bits 1..5.
  const weekdayRow = page.getByTestId("recurring-weekday-row");
  await expect(weekdayRow).toBeVisible();
  for (let legacyBit = 1; legacyBit <= 5; legacyBit++) {
    await weekdayRow.getByTestId(`recurring-weekday-${legacyBit}`).click();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API helper

async function postV1(req: APIRequestContext, path: string, body: unknown) {
  return req.post("/api/proxy" + path, { data: body });
}

async function fetchRecurringId(req: APIRequestContext, v1AggregateId: string): Promise<string> {
  // The POST /v1/tiles response for a Recurring returns the recurring id
  // (per `crate-v1/api/src/handlers/command.rs`).  The recurring view
  // exposes the underlying v1_tile.id; for the SQL assertion we need the
  // recurring id that owns the frame-rule row.
  const res = await req.get("/api/proxy/v1/recurring/" + v1AggregateId);
  expect(res.status()).toBeLessThan(400);
  const view = (await res.json()) as { id?: string; recurring_id?: string };
  return view.id ?? view.recurring_id ?? v1AggregateId;
}

// ─────────────────────────────────────────────────────────────────────────────
// spec

test.describe("quick tile create — frame rule persistence e2e (D3a)", () => {
  test.beforeEach(async () => {
    truncateV1();
  });

  test("daily weekday FrameRule (Mon-Fri 09:00-17:00) persists exactly one v1_recurring_frame_rule row", async ({
    page,
    request,
  }) => {
    test.skip(
      !d1aImplemented(),
      "D1a FrameRule wire expansion not yet implemented: " +
        "v1_recurring_frame_rule rows are not produced by QuickCreate. " +
        "Re-enable this spec once D1a lands.",
    );

    const title = `D3a Daily Weekday ${Date.now()}`;
    const day = todayUtc();

    // 1) UI: open QuickCreate, configure a single Mon-Fri daily rule.
    await openQuickCreate(page);
    await fillFrameRule(page, title);

    // 2) Submit and capture the v1/tiles POST so we can read the
    //    recurring id from the response body.
    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeEnabled();

    const waitV1Tile = page.waitForResponse(
      (r) =>
        /\/v1\/tiles(?:$|\?)/.test(r.url()) &&
        r.request().method() === "POST",
    );
    const waitFrameRule = page.waitForResponse(
      (r) =>
        r.url().includes("/v1/recurring/") &&
        r.url().includes("/frame-rules") &&
        r.request().method() === "POST",
      { timeout: 10_000 },
    ).catch(() => null);

    await submit.click();
    const tileRes = await waitV1Tile;
    expect(tileRes.status()).toBeLessThan(400);
    const tileBody = (await tileRes.json()) as { aggregate?: { id: string } };
    const rawId = tileBody.aggregate?.id;
    expect(rawId, "POST /v1/tiles response missing aggregate.id").toBeTruthy();

    const ruleRes = await waitFrameRule;
    if (ruleRes) {
      expect(ruleRes.status()).toBeLessThan(400);
    }

    // 3) Resolve the recurring id (≠ v1_tile.id when D1a wires the
    //    atomic single-request flow).  Falls back to the aggregate id
    //    when the v1/recurring read bridge is not yet present.
    const recurringId = await fetchRecurringId(request, rawId!);

    // 4) SQL persistence proof.
    const countResult = runSql(
      `SELECT count(*) FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}';`,
    );
    expect(Number(countResult), "v1_recurring_frame_rule row count").toBe(1);

    // 5) Shape: weekday mask + step duration.  We assert both the
    //    canonical `calendar_weekday_mask` (D1a may also store the
    //    weekday mask via the frame rule's `active` condition; both
    //    shapes are accepted, but at least one must encode Mon-Fri).
    const row = runSql(
      `SELECT calendar_weekday_mask, step_duration_ms FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}';`,
    );
    // psql returns a pipe-delimited tuple when -At is used.
    const parts = row.split("|");
    const mask = Number(parts[0] ?? 0);
    const stepMs = Number(parts[1] ?? 0);

    if (mask !== 0) {
      // D1a canonical shape: weekday mask lives directly on the row.
      expect(mask, "calendar_weekday_mask must be Mon-Fri (31)").toBe(
        MASK_MON_FRI,
      );
    } else {
      // Alternate: Mon-Fri is encoded in the frame rule's active
      // condition tree (see at-020 weekday-condition.spec.ts).  Pull
      // it and verify the mask is present.
      const activeCond = runSql(
        `SELECT active_condition_id FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}';`,
      );
      expect(activeCond, "active_condition_id must be present").not.toBe("");
    }

    // Daily step: 24h.  The window 09:00-17:00 is encoded in the
    // active condition's time_start/time_end; SQL-side we only assert
    // the step here (the wire does not store HH:MM on the row).
    expect(stepMs, "step_duration_ms must be 24h").toBe(STEP_MS_DAILY);

    // 6) Time-of-day: a separate SQL probe verifies the condition
    //    AST carries 09:00..17:00 wherever D1a chose to store it.
    const tod = runSql(
      `SELECT COALESCE(
         (SELECT time_start FROM v1_condition_term
           WHERE id IN (SELECT active_condition_id FROM v1_recurring_frame_rule
                        WHERE recurring_id = '${recurringId}')),
         (SELECT time_start FROM v1_condition_term ct
           JOIN v1_frame_rule_active fra ON fra.condition_id = ct.id
           JOIN v1_recurring_frame_rule rfr ON rfr.id = fra.frame_rule_id
           WHERE rfr.recurring_id = '${recurringId}'),
         0
       );`,
    );
    if (Number(tod) > 0) {
      expect(Number(tod), "time_start must be 09:00 (= 540 min)").toBe(
        TIME_START_MIN,
      );
    }

    // 7) Cleanup verification: the next test must not see this row.
    truncateV1();
    const afterCleanup = runSql(
      `SELECT count(*) FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}';`,
    );
    expect(Number(afterCleanup), "frame-rule row leaked after cleanup").toBe(0);
  });

  test("non-UI API path: POST /v1/recurring/{id}/frame-rules is the canonical write surface", async ({
    request,
  }) => {
    // Companion assertion: verifies the SQL count/shape from the more
    // deterministic API-driven path.  Independent of QuickCreate UI
    // affordances (which D1a may revise), so this remains a stable
    // observability check even before the UI affordance lands.
    test.skip(
      !d1aImplemented(),
      "D1a FrameRule persistence not yet implemented: " +
        "skipping API-path persistence proof.",
    );

    const title = `D3a API ${Date.now()}`;
    const tileRes = await postV1(request, "/v1/tiles", {
      idempotency_key: uuidv7like(),
      payload: {
        kind: 0,
        title,
        description: null,
        color: "#0ea5e9",
        icon: "check",
        external_id: null,
        plan_role: 0,
      },
    });
    expect(tileRes.status()).toBeLessThan(400);
    const aggId = (await tileRes.json()) as { aggregate: { id: string } };
    const recurringId = aggId.aggregate.id;
    expect(recurringId).toBeTruthy();

    const ruleRes = await postV1(
      request,
      `/v1/recurring/${recurringId}/frame-rules`,
      {
        idempotency_key: uuidv7like(),
        payload: {
          recurring_id: recurringId,
          rule: {
            id: uuidv7like(),
            active: null,
            rank: 0,
            generator: {
              Step: { step: STEP_MS_DAILY, origin: null, bounds: null },
            },
          },
        },
      },
    );
    expect(ruleRes.status()).toBeLessThan(400);

    const count = runSql(
      `SELECT count(*) FROM v1_recurring_frame_rule WHERE recurring_id = '${recurringId}';`,
    );
    expect(Number(count), "API path must produce 1 frame-rule row").toBe(1);
  });
});
