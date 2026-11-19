# T14 QuickCreate browser E2E — v2 opt-in → adopt → v1 materialization

Date: 2026-11-19. Issue: tastile/tastile-web#219 (root tastile/tastile-root#105 G4 T13/T14).

## Environment (isolated verification stack)

- Web dev server: `http://127.0.0.1:3124` (`next dev`, branch `219-v2-v1-expand`)
- Core API: `http://127.0.0.1:31410` (colima container `tastile-verify-api`,
  `tastile-core-verify:local`, `delivery=fake`, dedicated `tastile-verify-pgdata` volume,
  PG `127.0.0.1:55432`). Operational stack `127.0.0.1:31400` untouched.
- Auth: real Better Auth sign-up (`POST /api/auth/sign-up/email` 200) +
  `/api/auth/bridge` session; `E2E_BYPASS_AUTH=0`.
- v2 engine: `TASTILE_V2_ENABLED=true`, real `tastile-v2` CLI + seeded
  `scheduler-v1-expand` Wasm store (`/tmp/v2-web-store-expand`).
- Provenance caveat: Core `/v1/health` reports `build_identity.commit_sha: null`
  (image `tastile-core-verify:local` built 2026-11-17 without embedded SHA).
  v1 line is 1.1.0; exact source SHA is not attested by the image.

## Browser operations performed (real Chromium via Playwright)

1. Sign-up → bridge → `/dashboard/timeline/month` (no reload loop;
   `APEX_HOST=localhost` / `APP_HOST=127.0.0.1` fix verified).
2. `sidebar-new-tile` → workflow batch `workflow-batch-recurring` →
   repeat mode `毎日` (daily) → opt-in `v2-eval-optin` → `v2-eval-run`.
3. Result panel: `候補 14 件`, `status: ok`, occurrences `11/20 00:00 → 00:30`
   … `11/27`, `ほか 6 件`. Screenshot `screenshots/04-v2-result.png`.
4. `v2-eval-adopt` clicked → `v2EvalAdopted` notice (`v2 候補の時間帯を予定に反映しました`).
5. `quick-create-submit` → `POST /api/proxy/v1/schedule-definitions` **200**
   (`result:2`, `aggregate_meta.source_tile_id=01a1f320-ab85-7171-87b9-d0716d11f914`,
   90 `occurrence_ids`, 90 `placement_ids` returned in the command aggregate).
6. Read-back: `GET /api/proxy/v1/source-tiles/{id}` → `source-detail.json`.

## Meaning preservation — adoptable case (daily, fixed-step)

Adoption copies only the v1-compatible time-of-day window from the first v2
candidate. v1 remains the sole materialization path.

- v2 advisory candidates: 14 occurrences over the eval horizon
  (now → +14d), all `00:00 → 00:30` local (JST).
- v1 materialized placements: **90 placements, every one `15:00→15:30Z`
  (= 00:00→00:30 JST), daily cadence**, `2026-11-18T15:00Z` → `2027-02-15T15:30Z`.
- Overlap on the shared window: all v2 candidate time-of-day/cadence pairs are
  reproduced exactly by v1 placements. **Match: 14/14 candidates' time-of-day
  semantics preserved** (v2 preview horizon ≠ v1 generation horizon — see below).

Horizon difference (recorded, not a defect): the v2 eval derives
`range_start = max(authored start, now)` → +14d, so its first candidate is the
next midnight after submit-time now. v1 generation starts at the authored
recurrence start (today 00:00 JST, already past at submit) and generates ~90
days. Adoption never copies dates/horizon — only time-of-day — so the two
horizons are different responsibilities, not a semantic mismatch.

Unrelated-condition check: adoption wrote only `time.timeOfDay*` /
`time.span` fields via `applyV2Adoption`; `recurring.*`, `source.*`,
`plan.*` slices untouched (verified by `inputKey` staleness guard and the
wire builder — no weekday_mask/monthly/excluded_dates authored in this case).

## Unsupported / gated cases (real UI)

- Weekly recurrence (`毎週`): after opt-in the panel shows
  `曜日指定・月次ルール・除外日など v2 が表現できない条件が含まれるため評価できません`
  (`unsupported_semantics`), `v2-eval-run` and `v2-eval-adopt` are absent.
  Screenshot `screenshots/07-weekly-uncovered.png` (named `07-weekly-unsupported.png`).
- Contract change (this branch): `deriveV2SchedulerInput` now returns
  `unsupported_semantics` for `weekly`/`monthly` repeat modes and any authored
  `excludedDates`, and `unsupported_window` for fully-bound schedulable
  windows — before any subprocess call. Previously monthly was silently
  approximated as a daily step and weekday masks/excluded dates were dropped,
  producing adoptable-looking but non-equivalent candidates.
- v1 default unchanged: opt-in switch off → no v2 call; submit always uses
  the v1 `schedule-definitions` path.

## Incidents during verification

- Colima docker containerd `meta.db` I/O errors (host disk pressure) killed
  `tastile-verify-db`; recovered via `colima restart` — volume
  `tastile-verify-pgdata` intact, api/worker restart-policy recovered,
  `tastile-test-pg`/`tastile-tc299-pg` restarted manually. No data loss.
- `POST /api/proxy/v1/schedule-definitions` initially 401'd because the
  bridge session cookies were not yet established; fixed by calling
  `/api/auth/bridge` before submit (matches real login flow).

## Files

- `trace.json` — step log (signup → opt-in → result → adopt → submit → read-back).
- `source-detail.json` — v1 source-tile detail: 90 occurrences + 90 placements.
- `screenshots/` — dashboard, recurring form, opt-in, v2 result, adopted, weekly-unsupported.
