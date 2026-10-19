# C — Recurring + SourceSchedule

## 目的 (Purpose)

QuickCreate の §5 Recurring core（`repeatMode` / `weekdayMask` / `endDate` / `intervalValue|Unit` / `life.active.{startDate,endDate}`）と §5 Source パネル（`offsetMin` / `excludedDates` / `preferredDurationMinMax` / `splitPolicy` / `priority` / `relations` / `flowSequences`）を、`SourceSchedule`（`source_schedule.rs:11-119`）の全フィールドに正しくマッピングして `POST /v1/schedule-definitions` 経由で core に届ける。`recurring.frameRules[]` / `recurring.rules[]` は sub-project D、`recurring.condition` は sub-project E に分離。

## 対象フィールド (In-scope fields)

| Domain field | Type / Source | UI store path | Wire path | Current status |
|---|---|---|---|---|
| `SourceSchedule.required_duration_ms` | i64, `source_schedule.rs:14` | `time.durationMinMax.*` | `source_schedule.required_duration_ms` (wire-builder:213-450) | ✓ |
| `generation.kind` | i16 OneTime(0)/Recurring(1)/DemandDriven(2), `source_schedule.rs:25` | `recurring.repeatMode` (0..4) | `generation.kind` (0/1/2 only) | ✓ mapped; "condition" branch is dropped silently |
| `generation.at` | Instant?, `source_schedule.rs:27` | `time.span.start` | `generation.at` when OneTime | ✓ |
| `generation.starts_at` | Instant?, `source_schedule.rs:29` | `recurring.life.active.startDate` | `generation.starts_at` | ✓ |
| `generation.interval_ms` | DurationMs?, `source_schedule.rs:31` | `recurring.intervalValue/Unit` | `generation.interval_ms` | ✓ |
| `generation.ends_at` | Instant?, `source_schedule.rs:33` | `recurring.endDate` | `generation.ends_at` | ✓ |
| `generation.weekday_mask` | i8?, `source_schedule.rs:34` | `recurring.weekdayMask` | `generation.weekday_mask` | ✓ |
| `generation.date_range_start` | String? (date), `source_schedule.rs:36` | `recurring.life.active.startDate` | `generation.date_range_start` | ✓ |
| `generation.date_range_end` | String? (date), `source_schedule.rs:38` | `recurring.life.active.endDate` | `generation.date_range_end` | ✓ |
| `generation.excluded_dates` | Vec<String>, `source_schedule.rs:40` | `source.excludedDates` | `generation.excluded_dates` | ✓ |
| `generation.offset_min` | i16?, `source_schedule.rs:47` | `source.offsetMin` | `generation.offset_min` | ✓ |
| `window.start_offset_ms / end_offset_ms` | i64, `source_schedule.rs:106-107` | derived from `time.span` | `source_schedule.window.{start_offset_ms,end_offset_ms}` | ✓ implicit |
| `split_policy.kind` | i16 Unsplit(0)/Split(1), `source_schedule.rs:112` | `source.splitPolicy` | `source_schedule.split_policy.kind` | ✓ (kind only) |
| `split_policy.min_segment_ms` | i64?, `source_schedule.rs:114` | — | — | ⚠ partial |
| `split_policy.max_segment_ms` | i64?, `source_schedule.rs:116` | — | — | ⚠ partial |
| `split_policy.max_segments` | u32?, `source_schedule.rs:118` | — | — | ⚠ partial |
| `priority` | i32, `source_schedule.rs:20` | `source.priority` | `source_schedule.priority` | ✓ |
| `relations[]` | Vec, wire spec | `source.relations[]` | top-level `relations[]` | ✓ |
| `flows[]` (atomic) | Vec<Flow>, wire spec | `source.flowSequences[]` | top-level `flows[]` | ✓ (note: distinct from `plan.planning.flows[]` which is D-throw) |
| `Recurring.life.active.{startDate,endDate}` | LocalDate?, `v1/08:26-39` | `recurring.life.active.*` | `date_range_{start,end}` | ✓ |
| `Recurring.life.state` | i16 ACTIVE/PAUSED/ENDED/CANCELLED, `v1/08:30-37` | — | — | ✗ no UI |
| `StepGenerator.{step,origin,bounds}` | tree, `v1/08:71-73` | `recurring.intervalValue/Unit` (step only) | `generation.interval_ms` | ⚠ partial (origin/bounds absent) |
| `ReferenceGenerator.{referenceId,align}` | tree, `v1/08:80-82` | — | — | ✗ no UI |
| `CalendarGenerator.{unit,weekdayMask,holidayKind}` | tree, `v1/08:97-101` | `recurring.weekdayMask` (weekday only) | `generation.weekday_mask` | ⚠ partial |

## 変更手順 (Change steps)

1. **Verify `recurring.repeatMode` → `generation.kind`**: confirm wire-builder maps "once"→0, "weekly"/"daily"/"interval"→1, "condition"→2. "condition" branch must remain silent drop until E (do not throw).
2. **Verify `recurring.weekdayMask` round-trip**: ensure bitmask is bit-7=Mon through bit-1=Sun or whatever the v1/08 mapping dictates; confirm by submitting a weekly tile and inspecting `v1_placement.baseline` per weekday.
3. **Verify `intervalValue/Unit`**: "min"/"hour"/"day" all map to ms. Round-trip 30 min → 1800000 ms.
4. **Verify `recurring.endDate` + `recurring.life.active.{startDate,endDate}`**: `endDate` → `generation.ends_at`, `life.active.endDate` → `generation.date_range_end`. Distinguish Instant vs LocalDate semantics.
5. **Verify `source.{offsetMin, excludedDates, preferredDurationMinMax, splitPolicy, priority}`**: each must round-trip exactly.
6. **Verify `source.{relations, flowSequences}`**: these are top-level in the payload (not nested under `source_schedule`); check that v1/14 read model sees them as SourceTile relation/flow aggregates.
7. **Acknowledge partial mappings in §リスク**: split_policy.{min,max}_segment_ms and max_segments have no UI; StepGenerator.{origin,bounds}, ReferenceGenerator, CalendarGenerator.{unit,holidayKind} are partial; Recurring.life.state machine is absent.

## e2e 検証 (Verification)

New spec: `tastile-web/e2e/quick-create-recurring-e2e.spec.ts`.

Steps:
1. Open QuickCreate via the keyboard shortcut (`dashboard/layout-client.tsx:79`).
2. Fill §1 Identity: title = "Recurring study", kind = PLACEMENT (default), color/icon defaults.
3. §5 Recurring: repeatMode = weekly, weekdayMask = 0b0011111 (Mon-Fri), interval = 30 min, life.active.startDate = today, life.active.endDate = today + 14 days, endDate empty.
4. §5 Source: offsetMin = 540 (JST), excludedDates = [next Sunday], preferredDurationMinMax = {min:30min,max:60min}, splitPolicy = UNSPLIT, priority = 5.
5. Submit. Wait for the success toast.
6. WSL DB inspection: `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT generation->>'kind', generation->>'weekday_mask', generation->>'interval_ms', generation->>'date_range_end', split_policy->>'kind', priority FROM v1_source_schedule"`. Assert: kind=1, weekday_mask=31, interval_ms=1800000, date_range_end = today+14, split_policy.kind=0, priority=5.
7. Assert placements: `SELECT count(*) FROM v1_placement p JOIN v1_source_schedule s ON p.source_schedule_id=s.id WHERE s.generation->>'weekday_mask'='31'` — expect ~10 rows (14 days × Mon-Fri minus 1 Sunday exclusion).

Existing recurring spec `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts` must also be wslc-ized (G) before this can run.

## スコープ外 (Out of scope)

- `recurring.frameRules[]`, `recurring.rules[]` → D
- `recurring.condition` (FrameRule.active dynamic Condition) → E
- `plan.planning.flows[]` (legacy chain) → D
- `Recurring.life.state` machine UI → later
- `StepGenerator.{origin,bounds}`, `ReferenceGenerator.*`, `CalendarGenerator.{unit,holidayKind}` UI → later

## リスク (Risks)

- **LocalDate vs Instant**: `recurring.life.active.{startDate,endDate}` is `LocalDate` per `v1/08:26-39` while `generation.starts_at`/`ends_at` are `Instant`. Wire-builder must serialize the date string as YYYY-MM-DD without timezone coercion.
- **Weekday mask bit order**: mismatch between web's `0b0011111` (Mon-Fri) and core's bit-7 mapping. Verify by inspection of generated placements.
- **Partial split_policy**: only `kind` is wired. If user picks Split, server will reject with 400 (validation in `source_schedule.rs:112-118`). Mitigate by either adding UI for the remaining fields or rejecting Split in UI when min/max/max_segments are zero.
- **StepGenerator.origin/bounds**: if user expects "fire on next weekday after creation", server cannot honour it from the wire as currently emitted.
- **CalendarGenerator.holidayKind**: JPHoliday etc. not exposed; weekly-only tile on a Japanese holiday will still fire.
- **"condition" repeatMode**: silent drop — `recurring.condition` is Phase C/D. UI must either disable the option or label it "not yet supported".

## 完了基準 (Acceptance)

- All ✓ fields round-trip without 422 from core.
- Weekly Mon-Fri tile produces correct placement count in DB.
- 09:00 UTC offset with JST (offsetMin=540) produces placements at the right local time.
- excludedDates correctly skips specified dates.
- No regressions on default-state QuickCreate (covered by A).