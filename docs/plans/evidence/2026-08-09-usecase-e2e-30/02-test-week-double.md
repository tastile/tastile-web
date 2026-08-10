# USECASE 02 — test-week-double

Generated: 2026-08-09 (REWRITTEN + VERIFIED)

**Status**: VERIFIED (UI journey)

- Spec file: `e2e/usecase-02-test-week-double.spec.ts`
- Drive: UI (QuickCreate panel) — sidebar 新規 → title → Recurring subpanel → Weekly + Mon-Fri toggle → submit → focus view → back to day view → assert placement visible
- Run: `bun run test:e2e -- e2e/usecase-02-test-week-double.spec.ts`
- Wall time: 23.8s (cold POST /api/proxy/v1/schedule-definitions takes 5–13.5s)

## Result

```
✓  1 [chromium] › e2e\usecase-02-test-week-double.spec.ts:27:7
   › USECASE 02 — test-week-double
   › user creates a weekly Mon-Fri Recurring for one week; placements render on each weekday (23.8s)

1 passed (25.9s)
```

## What was verified (user-visible state only)

1. User opens QuickCreate via the sidebar 新規 button (`[data-testid='sidebar-new-tile']`).
2. User fills the title in `[data-testid='quick-create-input-title']`.
3. User opens the Recurring subpanel via `[data-testid='quick-create-tab-recurring']`; picks Weekly; toggles Mon..Fri (weekday bits 1..5, mask=0b00111110).
4. User submits via `[data-testid='quick-create-submit']`; panel closes.
5. App navigates to `/dashboard/timeline?focus=<tileId>` (focus view).
6. User navigates back to `/dashboard/timeline?view=day&date=2026-09-01`.
7. The placement with the new title is visible inside `[data-testid='day-panel']` (multiple Mon-Fri instances of the same title are expected — `.first()` is used in the assertion).

## Helper fix log

- `e2e/helpers/ui.ts::submitQuickCreate` timeout raised from default 5s to **45s** because `POST /api/proxy/v1/schedule-definitions` observed 5.0–13.5s on cold wslc port-forward; even 30s was too tight.
- `e2e/helpers/ui.ts::expectDayEventVisible` uses `.first()` instead of strict match — recurring materialisations produce multiple placements of the same title; strict `.toBeVisible()` fails on multi-match.
- `e2e/helpers/ui.ts::setQuickCreateRecurring` clicks Mantine `SegmentedControl` labels (not hidden radios) and closes the active subpanel via `section[data-panel-anim][aria-hidden='false']` after config.
- Spec adds a second `goToDay` after `submitQuickCreate` because the app routes to `?focus=<tileId>` after submit; the user must navigate back to see the day view.