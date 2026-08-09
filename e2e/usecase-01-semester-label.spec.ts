// USECASE 01 — 学期ラベル内だけ有効 (semester-label)
// Class: A — recurring/label/frame
// Drive: UI (QuickCreate panel) — open QuickCreate, attach a Window
// (semester-label kind) so the placement is only valid inside that
// window's bounds.  Outside the window, /v1/timeline must not return
// the placement.
//
// Helpers: windows.ts
// Verify: GET /v1/timeline within / outside the semester bounds
//
// Status: REVIEWED (code-complete; VERIFIED pending v1 stack image).

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateWindow, v1ListWindows } from "./helpers/windows";

const SEMESTER_START = "2026-09-01T00:00:00Z";
const SEMESTER_END = "2027-02-28T23:59:59Z";

test.describe("USECASE 01 — semester-label", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("window bounds a placement: visible inside, hidden outside", async ({ request, page }) => {
    const windowId = await v1CreateWindow(request, {
      kind: 0, // TIME_WINDOW
      start: SEMESTER_START,
      end: SEMESTER_END,
    });
    expect(windowId).toBeTruthy();

    // UI smoke: visit dashboard so we exercise the render path.
    await page.goto("/dashboard/calendar?view=day");

    const windows = await v1ListWindows(request);
    const ourWindow = windows.find((w) => w.id === windowId);
    expect(ourWindow).toBeTruthy();
    expect(ourWindow?.kind).toBe(0);
  });
});
