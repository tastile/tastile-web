# 05 — Use-Case Capability Tree

Cross-cutting decomposition of every authoring/scheduling scenario in `tastile-core/docs/USECASE.md` (30 scenarios) and `tastile-core/docs/SCHEDULE.md` (realistic-day narratives) into required v1 domain structures, UI capabilities, commands, worker/read behavior, and observable evidence. Canonical source is `tastile-core/v1/`; conflicts with the narrative docs are flagged explicitly.

Every scenario is decomposed along 5 axes:

- **Domain structures** — which v1 entities, snapshots, or keys are involved.
- **UI controls** — the form surface needed in QuickCreate or its siblings (drawn from `tastile-web/src/features/create-tile/ui/` + dashboard timeline).
- **Commands** — which `CommandKind` + envelope path is used.
- **Worker/Read behavior** — which materializer, lazy-expand, or eval path fires.
- **Observable evidence** — how the running stack proves the scenario.

Numerical constants come from the `tastile-core/v1/HARNESS.md` registry. No new fields are invented. Spec-silent positions are flagged "**silent**".

The four judgment classes (`docs/USECASE.md:5-16`) map to authoring/scheduling as follows; every scenario is placed in exactly one class.

---

## 0. Cross-cutting capability tree (applies to all 30 scenarios)

```
Scenario 1..30
├─ Domain structures (v1/02 + v1/03 + v1/05 + v1/13)
│  ├─ Tile { kind, owner, externalId, revision, content, visual, frame_rule? }
│  ├─ Plan  { role, references[], completion, planning, metrics[], decisions[] }
│  ├─ Completion { root: Condition, timeRequirements[], tasks[] }   (v1/13)
│  ├─ SourceSchedule { required_duration_ms, generation, window, split_policy, priority }   (source_schedule.rs:11-119)
│  ├─ Window { id, owner, kind: 0..3, bounds, rules[] }   (v1/03:73-130)
│  ├─ Frame { id, recurringTile, frameRule, rangeStart }   (v1/08)
│  ├─ Placement { Tile, Plan, baseline.span, baseline.inside.parent?, source: 0..4, life.detach/close }   (v1/02:131-204)
│  └─ Condition { ALL|ANY|NOT|TERM }   (v1/05:1-56, 10 Term kinds)
├─ UI controls (tastile-web/src/features/create-tile/ui/ + dashboard)
│  ├─ §1 IdentityPanel (tile.kind, title, description, color, icon, externalId)
│  ├─ §2 PlanSubPanel + CompletionSubPanel + ConditionEditor + FlowSequencePanel + RelationPanel
│  ├─ §3 TimePanel (span / durationMinMax / whenMode / timeOfDay / reference)
│  ├─ §4 WindowsPanel (Window[] CRUD)
│  ├─ §5 RecurringSubPanel (repeatMode / weekdayMask / endDate / interval / life / frameRules / rules / condition)
│  ├─ §5 SourceSubPanel (offset / excludedDates / preferredDuration / splitPolicy / priority / relations / flowSequences)
│  ├─ §6 AdvancedSubPanel (changeSets / rules)
│  └─ §7 MetaSubPanel (project / tags / memo / isLabelOnly)
├─ Commands
│  ├─ POST /v1/schedule-definitions    (PublishScheduleDefinitionPayload, CommandKind 30, atomic Tile+Plan+SourceSchedule)   (v1/14:418-428)
│  ├─ POST /v1/source-tiles            (CreateSourceTilePayload, CommandKind 31)   (v1/HARNESS table)
│  ├─ POST /v1/source-tiles/{id}       (UpdateSourceTilePayload, CommandKind 32)   (command.rs:212)
│  ├─ POST /v1/source-tiles/{id}/reflow (ReflowSourceTilePayload, CommandKind 33)  (command.rs:227)
│  ├─ POST /v1/source-tiles/{id}/cancel (CancelSourceTilePayload, CommandKind 35)  (V1_017, HARNESS §5)
│  ├─ POST /v1/tiles/{tileId}/update   (UpdateTilePayload, identity only per submit.ts:65-112)
│  └─ POST /v1/placements/{id}/changes (AppendChangesPayload, CommandKind 28, edit-mode span only)
├─ Worker / Read behavior
│  ├─ frame_repo::lazy_expand_owner_window   (HARNESS §5 2026-07-10 — owner-scoped)
│  ├─ frame_repo::plan_step_occurrences      (HARNESS §5 2026-07-23 — pure planner)
│  ├─ condition::evaluate_for_occurrence     (HARNESS §5 Stage 1-4 — GapTerm + Relation + Composition)
│  ├─ flow_tick::evaluate_window             (HARNESS §5 Phase C' — Gap→Flow 充填, AT-023..029)
│  ├─ worker::drive_fill                     (recurring prefill + flow fill, HARNESS §5 2026-07-10)
│  └─ timeline handler::lazy_expand_owner_window loop (HARNESS §5 2026-07-10 fix)
└─ Observable evidence
   ├─ DB rows: v1_tile / v1_plan / v1_source_tile / v1_placement / v1_frame / v1_window / v1_recurring_frame_rule / v1_recurring_life
   ├─ GET /v1/timeline?owner_ids=&start=&end=   (max 31 days, HARNESS §5 2026-07-10)
   ├─ GET /v1/source-tiles/{id}/placements / /completion
   └─ Forbidden on observable: isBreak / isMovable / isFixed / isOverlapAllowed / weekdayOnly / metadata_json / enum column / placement.completed
```

---

## A. 時刻・期間境界 (USECASE 01-06) — time/window/frame authoring + boundary correctness

### 01. 学期ラベル内だけ有効な時間割 (USECASE.md:23-51, AUTO)

- **Domain structures**:
  - LABEL Placement (`Plan.role = LABEL = 1`, v1/02:73-77): "1学期" `2026-04-01..2026-07-31` is a single fixed-span Placement, not a flag.
  - Recurring (`Tile.kind = RECURRING = 0` legacy read-only, v1/02:42-46 + v1/08) producing "timetable" placements, narrowed by:
    - `v1_window.kind = LABEL_SPAN (1)` referencing the LABEL Placement ID (v1/03:104-111).
    - `v1_window.kind = CALENDAR (0)` with `weekdayMask` Mon-Fri (v1/03:92-101).
    - `WindowRule` for "not holiday" (HolidayTerm inside CalendarTerm, v1/05:62-67).
- **UI controls**:
  - `IdentityPanel` (LABEL kind), `TimePanel` (fixed start/end span).
  - `WindowsPanel` × 2 (one CALENDAR Mon-Fri 09:00-17:00, one LABEL_SPAN pointing at the LABEL id).
  - `ConditionEditor` (Calendar weekdayMask + holidayKind=NOT_HOLIDAY) for the `v1_condition` root on `plan.completion` (v1/13:11).
- **Commands**:
  - LABEL: `POST /v1/schedule-definitions` (CommandKind 30, atomic Tile+Plan+SourceSchedule, `plan.role = LABEL`).
  - Recurring: `POST /v1/schedule-definitions` with `tile.kind = RECURRING` — **REJECTED** by handler at `command.rs:178-195` (`legacy_recurring_write_removed`). Authoring must use `POST /v1/source-tiles` (CommandKind 31) with `tile.kind = SOURCE (3)` and `SourceSchedule.generation.kind = RECURRING (1)`. Conflict between USECASE wording ("Recurring") and v1 contract documented in 01-domain-spec-fields.md:99-101.
- **Worker/Read behavior**:
  - `frame_repo::lazy_expand_owner_window` materializes source placements per Frame; each `v1_placement` row is filtered by Window membership at read (`timeline handler`).
  - LABEL Span shrink causes the LABEL_SPAN Window to narrow; placements in `[oldEnd, today)` stay materialized but get `life.close = true` via `change_set` layer=PLACEMENT key=SPAN_END clear, **not** physical delete (v1/10 §5, HARNESS §1-4).
- **Observable evidence**:
  - Apr weekday: `SELECT count(*) FROM v1_placement WHERE placement_source = 4 AND start >= '2026-04-07' AND start < '2026-04-11'` > 0.
  - Apr holiday: same query for that Tuesday's date = 0.
  - Aug: same query for any Tuesday in August = 0 (LABEL Span already ended).
  - LABEL row has `plan.role = 1` in `v1_plan.role`.

### 02. テスト週間だけ学習量 60→120 分、個別変更は維持 (USECASE.md:53-82, AUTO)

- **Domain structures**:
  - Two `v1_source_tile` for the same plan template, distinguished by `v1_window.kind = LABEL_SPAN (1)` pointing to "通常" LABEL (default 60 min `required_duration_ms`) vs "テスト週間" LABEL (override 120 min).
  - `plan.completion.timeRequirements[0].required = Range(60, 60)` (or 120, 120) — both share the same `Plan` body but carry different SourceSchedule durations. **The recurrence layer must not override the user's PLACEMENT-layer ChangeSet** (v1/04 §層, v1/10 §5).
  - User's per-Placement ChangeSet is `v1_change_set.layer = PLACEMENT (1)`, `v1_change_set.rank = 0`, `key = (group=Span, item=placementId, part=SPAN_START=0)`.
- **UI controls**:
  - `TimePanel` with `whenMode = timeOfDay` + start = original - 30 min shift; submit advances `time.span.start`.
  - Two parallel `WindowsPanel` rows bound to the two LABEL ids; duration is a per-SourceSchedule field, not a Plan field.
- **Commands**:
  - Initial: `POST /v1/source-tiles` × 2 (different LABEL-SPAN Window, different `required_duration_ms`).
  - Per-placement 30-min shift: `POST /v1/placements/{id}/changes` (CommandKind 28) with `expectedRevision`, layer=PLACEMENT (1), key=SPAN_START.
- **Worker/Read behavior**:
  - Reflow window re-evaluation runs on next `lazy_expand_owner_window` tick. Layer precedence: BASE → RECURRING (0) → PLACEMENT (1) → EXECUTION (2) — PLACEMENT wins (v1/04 §層).
- **Observable evidence**:
  - First call: `required_duration_ms = 60min` on `v1_source_tile` for 通常-window.
  - Re-resolve after entering テスト週間: same `v1_placement.baseline.span.end - start` is still user-shifted (-30 min) but `required_duration_ms` of the matched source = 120 min.
  - `v1_change_set` row exists for the SPAN_START with layer=1, not 0.

### 03. 5時間ごとの定期処理 × 2 Worker × 日付境界 (USECASE.md:85-122, AUTO) — pinned in `tile-create-e2e-wiring/01-domain-spec-fields.md:203-217`

- **Domain structures**:
  - One `v1_recurring` (legacy read path) with `frame_rule.generator = STEP` (`v1_recurring_frame_rule.generator_kind = 0`), `step_duration_ms = 18_000_000` (5h), `anchor_kind = ABSOLUTE` + `anchor_at = 2026-06-24T00:00:00Z`.
  - Owner profile `offset_min` controls calendar boundary (USECASE 03 says "日付跨ぎの offset は所有者プロファイルが指定" — `owner_profile.timezone_offset_min`, v1/10 §1 + v1/15).
  - Frame is uniquely keyed by `(recurringTile, frameRule, rangeStart)` (USECASE 03 期待) — corresponds to `v1_frame` UNIQUE constraint (V1_018 era), HARNESS §5 2026-07-10 reference.
- **UI controls**:
  - `RecurringSubPanel` / `SourceSubPanel` (only `SourceSchedule.generation.kind = RECURRING (1)` + `interval_ms = 5*60*60*1000` + `starts_at` = anchor + `offset_min` from owner profile).
  - No `frameRules[]` UI control — that field is `Recurring`-only and silently dropped / throw-stripped in QuickCreate (01-domain-spec-fields.md:69-71, ui-coverage-audit.md §4 lines 240-257).
- **Commands**:
  - `POST /v1/source-tiles` with `generation.kind = 1`, `interval_ms = 18_000_000`, `starts_at`, `offset_min`.
  - Worker drives `frame_repo::lazy_expand_owner_window` (or `frame_repo::lazy_expand_range` from worker `drive_fill`); lease + UNIQUE constraint prevent duplicate Frames (v1/10 §7).
- **Worker/Read behavior**:
  - `frame_repo::plan_step_occurrences` (HARNESS §5 2026-07-23) is pure: same `StepRuleInputs` → same `Vec<OccurrenceCandidate>`. The `origin = Absolute` snap-back decides whether a step straddles the 09:00 Asia/Tokyo / 00:00 UTC day boundary.
  - Materialization uses the `UNIQUE (recurring_tile, frame_rule, range_start)` index to absorb concurrent worker claims.
- **Observable evidence**:
  - 72h window: 72/5 = 14 (or 15) `v1_frame` rows. Replay from a second worker: same count, no duplicate (idempotency under lease expiry).
  - `v1_placement` for one frame: `source = 1 (RECURRING legacy) | 4 (SOURCE)` — must be 4 for new writes post-V1_017 (`v0.5.3 commitment`, v1/02:190-192).
  - Cross-day frame: `range_start` is UTC but `offset_min` is applied at placement span computation.

### 04. 30分ちょうどの空白だけ休憩候補 (USECASE.md:124-156, AUTO) — covered by AT-023/024

- **Domain structures**:
  - `v1_window.kind = GAP (3)` (v1/03:120-128) with `rules[]` containing a `GapTerm` whose `size = Range(min=30min, max=null)` (v1/05:102-115).
  - `v1_flow` (`flow_repo` + `v1_flow_candidate_output_proposal` per HARNESS §5 Phase C') with `candidate.output = PROPOSE_PLACEMENT` (HARNESS `v1/12 §C'`).
  - 休憩 Plan is just a `Plan { role: EXECUTABLE, completion.root = true, timeRequirements[0].required = Range(30min, 30min) }` — **no `isBreak` flag, no `target_rest_min` field** (v1/10 §9, v1/00:325-339).
- **UI controls**:
  - `FlowSequencePanel` (top-level `flows[]` on `PublishScheduleDefinitionPayload`, ui-coverage-audit.md §2 row 78).
  - `ConditionEditor` set to GapTerm with min=30min.
  - `WindowPanel` row kind=GAP (this is the wire's `Window.kind = 3`, no special subkind in `Condition`).
- **Commands**:
  - `POST /v1/source-tiles` + `POST /v1/schedule-definitions` for the "anchor" pair.
  - `POST /v1/schedule-definitions` with `flows[]` field populated (currently **throws** at `quick-create-schedule-wire.ts:249-257` if any other legacy flow/rule field is set; flows[] itself is **not** in that throw list per ui-coverage-audit.md §2 row 78 — verified clean).
- **Worker/Read behavior**:
  - `flow_tick::evaluate_window` (HARNESS §5 Phase C', wall 31–52 ms per occurrence, AT-027/028/029). Per-gap dispatcher writes `placement_source = 2 (FLOW legacy)` — **deprecated for new writes** post-`v0.5.3`; canonical path is `source = 4 (SOURCE)` via a producer flow. Spec narrative (`Phase C'` HARNESS) and v1 commitment (`v0.5.3` of v1/02:192) — **conflict** flagged below.
  - `condition::evaluate_for_occurrence` for the GapTerm fast path (Stage 1, HARNESS §5 2026-07-07) reads `gap_repo::list_gaps_for_window` only when the AST contains a `GapTerm`.
- **Observable evidence**:
  - 30 min exact gap: `v1_placement` with `source.detail` referencing flow+plan_id is inserted.
  - 29 min 59 s 999 ms: count = 0 in same window. AT-024.
  - Round-trip equal ms: `size.min_ms == size_inclusive` is **inclusive** in v1 (`AT-2.5` of `at_condition_gap_emission.rs`).

### 05. Gap 生成済み休憩候補の消失 (USECASE.md:159-192, AUTO or DECISION)

- **Domain structures**:
  - Existing Flow-emitted 休憩 Placement (source=2 legacy | 4 SOURCE post-V1_017).
  - New fixed Placement closing the Gap. Conflict is resolved by `change_set` layer=PLACEMENT (1) on the Flow's placements, marking them as `revoked = true` (v1/04 §Key, v1/02:148).
  - USECASE expects "対応する Recurring / Flow 由来 ChangeSet が取消候補になる" → mapped to `v1_change_set` row with `kind = CLEAR (1)`, `source = FLOW (1) | SOURCE (5)`, `key = (group=Span, item=placement_id, part=SPAN_START)`, plus a `DecisionRun` if user must approve.
- **UI controls**:
  - Timeline view surface (`/dashboard/timeline`) shows BLOCKED badge on the Flow-emitted placement + "candidate to revoke" hint, sourced from the DecisionRun's candidates.
  - `DecisionPanel` (Phase D) lists revocation candidates when `decision.observe.scope = PLACEMENT (2)`.
- **Commands**:
  - New fixed: `POST /v1/placements` (CommandKind 27, `CreatePlacementPayload`, source=0 MANUAL) — *legacy manual only* per `command.rs:252`; new writes use SourceTile path. **Conflict**: USECASE 05 calls this a direct "固定 Placement" but v1 says all new placements are source-routed post-`v0.5.3`.
  - Revoke: `POST /v1/placements/{id}/changes` (CommandKind 28) with `kind = CLEAR` for the Flow's placements, **or** a `Decision` flow that emits the same change.
- **Worker/Read behavior**:
  - `change_set_resolver` (HARNESS §1-4 + §1-8) reports the Flow placement as BLOCKED (state=2) once the Gap is gone.
  - `Execution` already started: change is silent. `execution_basis` snapshot is frozen (v1/10 §6, v1/02 §Execution).
- **Observable evidence**:
  - `v1_placement WHERE id = flow_placement_id` is **not** deleted (no row gone); `v1_placement.life.close = true` (or `revoked = true` column) flips.
  - `v1_change_set` row exists with `layer = 1` (PLACEMENT), `kind = 1` (CLEAR), `source = 5` (SOURCE).
  - If user had started an Execution: `v1_execution` row untouched, `v1_execution_basis` Span unchanged.

### 06. 親 Scope 縮小で子 Placement が範囲外 (USECASE.md:195-227, AUTO)

- **Domain structures**:
  - Child Placement: `baseline.inside.parent` references parent Placement ID (v1/02:142).
  - `v1_window.kind = PARENT_SPAN (2)` (v1/03:113-118) bounds the child's effective span.
  - Child has `ChangeSet` layer=PLACEMENT (1) on `SPAN_START` that detaches it (USECASE: detach 済み) — v1/02:148 "detach フラグ = 自動管理から外れているか".
- **UI controls**:
  - `RelationPanel` with `pick = WITHIN` (1) + `windowKind = PARENT_SPAN` (2) + `referenceId` = parent.
  - `AdvancedSubPanel` to set the detach ChangeSet (not currently wired in QuickCreate — `advanced.rules[]` THROWS at `quick-create-schedule-wire.ts:246-248`).
- **Commands**:
  - Initial: `POST /v1/source-tiles` with `plan.references[]` carrying `target.kind = 1 (SERIES)` for the parent.
  - Shrink parent: `POST /v1/placements/{parent_id}/changes` with `key = (group=Span, item=parent_id, part=SPAN_END)` + value = new earlier end.
- **Worker/Read behavior**:
  - `resolver` (v1/07) computes `EffectivePlacement`. Detached children keep their old SPAN_END (no `PARENT_SPAN` derivation applied).
  - Non-detached children get `ResolutionViolation` with `kind = OUTSIDE_PARENT` (**silent** in v1/14 — derive from the change_set + window combination). Returns BLOCKED (state=2).
- **Observable evidence**:
  - Detached child: `v1_placement.life.detach = true` and span unchanged after parent shrink.
  - Non-detached child: same DB row + `v1_resolution_violation` (or equivalent) listing the parent out-of-range; GET `/v1/timeline` returns this placement with `resolution.state = BLOCKED` (2).
  - `v1_change_set` rows for parent span appear with `layer = 1` (PLACEMENT).

---

## B. 変更競合・分割 (USECASE 07-12) — ChangeSet layer/rank/Key contract + SplitPolicy

### 07. detach 済みの子 Placement は親変更へ自動追従しない (USECASE.md:229-261, AUTO)

- **Domain structures**: same as 06, but emphasises the `v1_change_set.layer = PLACEMENT (1)` precedence over `RECURRING (0)` for the child.
- **UI controls**: timeline view shows detach lock icon (kind=none, just a chip).
- **Commands**: `POST /v1/placements/{child_id}/changes` (CommandKind 28) key=SPAN_START/END.
- **Worker/Read behavior**: `resolver` v1/07 §3: when the same `key` has a higher layer entry, lower layer is dropped (not "override" — the higher layer is the value used). When the child is detached, it has no parent-derived candidate at all.
- **Observable evidence**: same as 06, with explicit `v1_change_set` query: `SELECT layer, rank, group_, item, part FROM v1_change_set WHERE placement_id = $1`.

### 08. 深い入れ子と循環参照 (USECASE.md:263-297, REJECT / BLOCKED)

- **Domain structures**:
  - `v1_plan.references[]` with `TargetSelector.kind = SERIES (1)` or `EXACT (0)`.
  - `v1_placement.baseline.inside.parent` chain forms a DAG. Cycle detection at write time (v1/13 §order cyclic detection also applies to Task.order but analogously for placement nesting).
- **UI controls**:
  - `RelationPanel` shows proposed parents; cycle is rejected client-side before submit.
- **Commands**:
  - `POST /v1/source-tiles` + `POST /v1/schedule-definitions` — both validate cycles at handler.
  - The cycle is a `CONFLICT (5)` per `v1/14:64-83` if server-side, or `VALIDATION (0)` if static.
- **Worker/Read behavior**: `resolver` short-circuits on cycle; no Placements emitted.
- **Observable evidence**:
  - Cycle attempt: HTTP 409 with `ApiError.kind = 5` (CONFLICT).
  - No `v1_placement` row inserted.

### 09. 意図的な重なりを許容して、両方を実行する (USECASE.md:299-332, AUTO)

- **Domain structures**:
  - Two `v1_source_tile` with overlapping `required_duration_ms` windows. No `v1_change_set` conflict — overlap is allowed by default. v1/10 §5: "placement は frame 起点、change_set は layer 解決" — overlap is not a change conflict, it is a placement concurrency fact.
  - `Execution` runs in parallel; `v1_execution_basis.span` snapshots each one (v1/10 §6).
- **UI controls**: timeline view shows two overlapping blocks side-by-side (Mantine Schedule or v0 Calendar grid), both `EXECUTABLE` chips.
- **Commands**: two `POST /v1/source-tiles` with overlapping Window kinds (CALENDAR vs CALENDAR).
- **Worker/Read behavior**: `materialize` from two independent frames, no deduplication.
- **Observable evidence**:
  - Two `v1_placement` rows with overlapping `baseline.span`.
  - `v1_execution_basis` snapshots both at start.

### 10. 強い禁止条件と弱い回避条件が衝突する (USECASE.md:334-374, BLOCKED / DECISION)

- **Domain structures**:
  - `plan.completion.root` with both `NOT (avoidCondition)` (soft) and `All (requiredCondition)` (hard).
  - `v1_decision` with `observe.scope = PLACEMENT (2)` evaluating the conflict; `candidates[]` enumerate alternatives (v1/06).
- **UI controls**:
  - `ConditionEditor` showing the All/Any/Not tree.
  - `DecisionPanel` listing candidates and waiting for user input (Phase D surface).
- **Commands**: `POST /v1/schedule-definitions` → server detects BLOCKED, returns 422 with `ApiError.kind = 6` (BLOCKED) + `violations[]`. Decision flow opens via `POST /v1/sessions` (v1/06 §Session).
- **Worker/Read behavior**: `resolver` emits `ResolutionViolation` (v1/07 §3, state=BLOCKED 2). `decision_run` is created for unresolved cases.
- **Observable evidence**:
  - HTTP 422 with structured `violations[]`.
  - `v1_resolution_violation` row exists.
  - `v1_decision_session` row opens with the candidate set.

### 11. 同一 layer・同一 rank・同一 Key への競合変更 (USECASE.md:376-407, REJECT)

- **Domain structures**: `v1_change_set` with `(layer, rank, key)` unique tuple; v1/10 §5: "同一 layer / 同一 rank / 同じ Key に異なる値 → 競合 (BLOCKED). 静かに上書きしない".
- **UI controls**: `AdvancedSubPanel.changeSets[]` is the wire surface; **currently throws** at `quick-create-schedule-wire.ts:246-248`. Sub-project D (`tile-create-e2e-wiring/05-impl-order.md`) targets either wire expansion or UI removal.
- **Commands**: `POST /v1/placements/{id}/changes` twice with same key different value; second call gets `STALE_REVISION (2)` or `CONFLICT (5)`.
- **Worker/Read behavior**: `change_set_resolver` raises on the conflict.
- **Observable evidence**:
  - HTTP 409 with `kind = 5` (CONFLICT) or 422 with `kind = 2` (STALE_REVISION).
  - `v1_change_set` table has exactly one row per `(placement_id, layer, rank, group_, item, part)`.

### 12. 分割可能な作業に複数の時間条件を重ねる (USECASE.md:409-451, AUTO)

- **Domain structures**:
  - `SourceSchedule.split_policy = SPLIT (1)` with `min_segment_ms`, `max_segment_ms`, `max_segments` (`source_schedule.rs:112-118`).
  - `v1_placement_source_ref_producer` (V1_017, HARNESS §5) carries `(producer_kind, producer_id, producer_revision, local_id)`. Split occurrences share `producer_id` but have distinct `local_id`.
- **UI controls**:
  - `SourceSubPanel.splitPolicy` editor: kind, min, max, maxSegments.
- **Commands**: `POST /v1/source-tiles` with `split_policy.kind = 1`.
- **Worker/Read behavior**:
  - `frame_repo::plan_step_occurrences` is pure. `lazy_materialize_one` writes one Frame per occurrence; split parts share the source's revision.
  - AT-029 (HARNESS §5 Phase C' / 2026-07-23 abort log): one Plan across multiple Gaps → 1 source, 2 placements, idempotency via `UNIQUE` on `v1_frame` and `v1_placement_source_ref_producer` + idempotency_key = UUIDv5.
- **Observable evidence**:
  - `v1_placement_source_ref_producer` rows share `producer_id`, distinct `local_id`.
  - `v1_placement` count = 2 (or N per max_segments), each with `source.kind = SOURCE (4)`.
  - `v1_change_set` only on placements whose `producer_revision` is bumped.

---

## C. 完了・実行 (USECASE 13-25) — Completion tree, Execution lifecycle, idempotency

### 13. 条件付き Task 表示・順序・他タイル参照 (USECASE.md:453-495, AUTO)

- **Domain structures**:
  - `plan.completion.tasks[]` with `TaskDefinition { id, content, show: Condition?, complete: Condition, order[] }` (v1/13:122-180).
  - `show` uses `TaskTerm` (`visible | marked | completed | not_completed`, v1/05:46).
  - `order[]` is `Vec<TaskOrderRelation { BEFORE (0) | AFTER (1), otherTaskId }`; cycle detection at save (v1/13:164-172).
- **UI controls**:
  - `CompletionSubPanel` → `TaskListEditor` with show / complete / order.
  - `ConditionEditor` per Task for `show` and `complete`.
- **Commands**:
  - `POST /v1/schedule-definitions` with `plan.completion.tasks[]` populated (✓ per `tile-create-e2e-wiring/02-ui-coverage-audit.md` §2 row 54).
- **Worker/Read behavior**:
  - `completion_evaluator` reads `Task.show` first; hidden tasks don't appear in `CompletionResult.terms[]`.
  - `completion.required_timeRequirements` and `tasks` are siblings under `root` (v1/13:11-14, v1/10 §7).
- **Observable evidence**:
  - `v1_task_definition` rows under the Plan id.
  - `v1_task_order_rule` rows for `order[]`.
  - GET `/v1/tiles/{id}/completion` returns `CompletionResult.terms[]` filtered by `show`.

### 14. テンプレート更新が既存 Placement と Execution を壊さない (USECASE.md:497-531, AUTO)

- **Domain structures**:
  - `POST /v1/source-tiles/{id}` (`UpdateSourceTilePayload`, CommandKind 32) bumps `revision`. **Existing placements keep `execution_basis` snapshot** (v1/10 §6).
  - The Source's `producer_revision` is bumped in `v1_placement_source_ref_producer`; reflow does **not** retroactively rewrite past placements.
- **UI controls**:
  - `IdentityPanel` / `SourceSubPanel` editable when in edit mode (`submitUpdateTile`, `submit.ts:65-112`).
- **Commands**: `PUT /v1/source-tiles/{id}` with `expectedRevision` (mandatory, V1_017 era).
- **Worker/Read behavior**: `reflow_owner_window` (`crates/v1/storage/src/source_tile_repo.rs::reflow_owner_window`, HARNESS §5 2026-07-15) regenerates new placements; old ones with `producer_revision < new` are closed (not deleted) by `close_legacy_reflow_targets`.
- **Observable evidence**:
  - Old placements: `v1_placement_source_ref_producer.producer_revision = old`; new placements: new revision; `v1_placement_source_ref_producer` UNIQUE on `(producer_id, producer_revision, local_id)` pins them.
  - Executions untouched: `v1_execution_basis` row count and span unchanged.

### 15. 外部カレンダー更新とユーザー編集が衝突する (USECASE.md:533-566, BLOCKED / DECISION)

- **Domain structures**:
  - Imported placement (`source = IMPORT (3)`) with `source.detail.source` + `externalId`.
  - User `ChangeSet` (layer=PLACEMENT=1) on the same placement.
  - Re-import: `v1_change_set` for layer=IMPORT (the only place where the IMPORT layer can be written; `v1/04` has it as a `ChangeSource` but not as a `ChangeLayer`. **Conflict / spec-silent** — see flag below.)
- **UI controls**:
  - Timeline view shows "external updated" badge with diff.
  - `DecisionPanel` offers merge / keep / discard candidates.
- **Commands**: import re-runs via `POST /v1/schedule-definitions` with `source = IMPORT` payload; per-placement import update via `POST /v1/placements/{id}/changes` (CLEAR + SET sequence).
- **Worker/Read behavior**:
  - `resolver` flags state=BLOCKED (2) when the external update would override a user `ChangeSet`. The `change_set` order: layer ASC wins → user wins over external. **Conflict**: USECASE says "外部更新とユーザー編集が衝突" — v1's `ChangeLayer` has 4 values (RECURRING, PLACEMENT, EXECUTION, SOURCE) per `v1/HARNESS` table; **IMPORT is not a `ChangeLayer`**. The conflict is therefore resolved as: user ChangeSet layer=PLACEMENT, external = source-level regeneration (HARNESS §1-7 "source は履歴と重複防止のため保持するが、現在値を暗黙に支配しない"). External update creates a new Source revision (V1_017); user's PLACEMENT-layer ChangeSet survives on the old placement but that placement is now `producer_revision = old` and gets `close_legacy_reflow_targets`'d.
- **Observable evidence**:
  - New external revision: `v1_source_tile.revision` bumps; `v1_placement_source_ref_producer.producer_revision` reflects new.
  - User-edited placement: now `life.close = true`; `v1_change_set` row preserved for audit.

### 16. 終了日なし Recurring を有限 Horizon で扱う (USECASE.md:568-604, AUTO)

- **Domain structures**:
  - `generation.ends_at = null` (infinite) per `source_schedule.rs:33`.
  - API: `GET /v1/timeline` accepts a finite `start..end` window (max 31 days per HARNESS §5 2026-07-10).
- **UI controls**:
  - `RecurringSubPanel.endDate` is optional.
  - Timeline view has a date-pill; passing the cap returns 400 + `kind = VALIDATION (0)` (timeline 31-day gate).
- **Commands**:
  - `POST /v1/source-tiles` with `generation.ends_at = null`.
  - Read: `GET /v1/timeline?owner_ids=&start=&end=` (window).
- **Worker/Read behavior**: `frame_repo::lazy_expand_owner_window` materializes only the requested window. No infinite scan.
- **Observable evidence**:
  - `v1_source_tile.generation_ends_at IS NULL`.
  - GET `/v1/timeline` with 366-day window: 400 + `{"kind":0, "message":"window too large: 366 days requested, max 31 days", ...}`.
  - 7-day window: `v1_placement` count = `7d × 24h / step_hours × (split_segments if any)`.

### 17. 最小時間値 1ms を暗黙丸めしない (USECASE.md:606-639, AUTO)

- **Domain structures**:
  - `DurationMs` is `i64` (`source_schedule.rs:14`, `v1/13:18`). No implicit floor at 1s, 1min, etc.
  - 1ms values are valid for `span.end - span.start` and `required_duration_ms`.
- **UI controls**: `TimePanel.durationMinMax` accepts 0+ ms (no input rounding). Currently the wire-builder `quick-create-schedule-wire.ts:263-268` requires a matching `timeRequirement` to express the range — design intent is explicit, no rounding.
- **Commands**: `POST /v1/schedule-definitions` with `required_duration_ms = 1` and `time_requirements[0].required = Range(1, 1)`.
- **Worker/Read behavior**: `plan_step_occurrences` does not snap; `v1_placement.baseline.span` preserves the 1ms duration.
- **Observable evidence**:
  - `v1_placement.baseline` JSON shows `span.end - span.start = 1ms`.
  - `v1_source_tile.required_duration_ms = 1`.

### 18. DurationMs の最大値近傍で溢れない (USECASE.md:641-674, AUTO)

- **Domain structures**: i64 ms ≈ 292 million years; `v1_change_set` value can hold 8 bytes via i64 too (v1/04 §Key); the only places with overflow risk are `step_duration_ms` and `interval_ms` (i64 ms). No places truncate to i32.
- **UI controls**: numeric input as BigInt-safe text or string.
- **Commands**: `POST /v1/source-tiles` with `interval_ms = i64::MAX - 1` succeeds; pure 200.
- **Worker/Read behavior**: `plan_step_occurrences` does not multiply beyond i64 safe; `range_end - range_start` may overflow → that's a `Validation` error at API, not a panic.
- **Observable evidence**:
  - `v1_source_tile.interval_ms = 9223372036854775806` (i64::MAX-1) reads back identical.
  - `cargo test -p storage --test at_recurring_fill_e2e` 5/5 Green (HARNESS §5 2026-07-10).

### 19. 1日の中に 10,000 件の重なった Placement (USECASE.md:676-705, AUTO)

- **Domain structures**: `v1_placement` rows are independent; no implicit cap. `v1_window.kind = CALENDAR (0)` accepts up to N overlapping placements. 31-day timeline cap is on the read window, not on per-day count.
- **UI controls**: `RecurringSubPanel` with very small `interval_ms` (e.g. 1s) + 1-day window.
- **Commands**: `POST /v1/source-tiles` + read.
- **Worker/Read behavior**: `lazy_expand_owner_window` may produce 10k+ `v1_placement` rows; `cargo test -p storage --test at_recurring_fill_e2e::at_recurring_fill_owner_window_emits_and_idempotent` covers 48 / day, scales linearly.
- **Observable evidence**:
  - 86,400 placements in `v1_placement` for 1 day × 1s interval (1s × 86400 = 86,400; USECASE says 10,000, so 1.44s cadence or a 144-min window).
  - `GET /v1/timeline` with 1-day window returns the full set; response size linear in N.

### 20. 明示 offset、端末・サーバー差で結果を変えない (USECASE.md:707-743, AUTO)

- **Domain structures**: `generation.offset_min` (smallint, `source_schedule.rs:47`) is the canonical calendar-boundary offset. `owner_profile.timezone_offset_min` (v1/10 §1, v1/15) is a separate owner-level value. No client/browser tz is consulted.
- **UI controls**: `SourceSubPanel.offsetMin` editor with explicit numeric input.
- **Commands**: `POST /v1/source-tiles` with `generation.offset_min = 540` (Asia/Tokyo).
- **Worker/Read behavior**: `plan_step_occurrences` is pure and offset-aware; same inputs from any client produce the same `Vec<OccurrenceCandidate>`.
- **Observable evidence**:
  - `v1_source_tile.generation_offset_min = 540` reads back identical.
  - `v1_frame.range_start` is in UTC; `v1_placement.baseline.span` is in UTC; offset_min is applied at the calendar-boundary snap (USECASE 03 期待 1日跨ぎの offset).

### 21. 同じ Placement から同時に Execution を開始する (USECASE.md:745-779, AUTO)

- **Domain structures**:
  - `v1_execution` unique constraint: at most 1 ACTIVE (state=0) Execution per Placement (HARNESS §1-6, v1/02 §Execution).
  - `v1_execution_basis` snapshot: `(BasisValue[], resolutionHash)` taken at start (v1/10 §6).
- **UI controls**:
  - Timeline view shows "already in progress" + idempotent retry hint.
- **Commands**: `POST /v1/executions` (`StartTilePayload`) twice → second returns 200 with `aggregate.execution_id = same` (CommandResult.ALREADY_APPLIED=1) or 409 with `kind=5` (CONFLICT) if the first Execution finished.
- **Worker/Read behavior**: same path.
- **Observable evidence**:
  - `v1_execution` count per placement_id is at most 1 with `state IN (0, 1)`.
  - `v1_execution_basis` row exists with `resolutionHash`.

### 22. Pause / Resume / Finish の異常順序 (USECASE.md:781-813, REJECT)

- **Domain structures**:
  - Execution state machine: ACTIVE (0) ↔ PAUSED (1) → FINISHED_NORMAL (2) | FINISHED_VOID (3) (HARNESS §1-6, v1/02).
  - `v1_execution_segment`: at most 1 with `end_at = null` at any time (HARNESS §1-6).
- **UI controls**: ExecutionPlayer (Phase D surface) hides Pause when FINISHED, hides Resume when ACTIVE.
- **Commands**:
  - `POST /v1/executions/{id}/pause` when FINISHED → 409 + `kind = 5` (CONFLICT).
  - `POST /v1/executions/{id}/resume` when ACTIVE → same.
  - `POST /v1/executions/{id}/finish` twice → first APPLIED, second ALREADY_APPLIED or CONFLICT.
- **Worker/Read behavior**: invariants enforced in command handler.
- **Observable evidence**:
  - Forbidden transitions return `ApiError.kind = 5` (CONFLICT) or `2` (STALE_REVISION) when expectedRevision fails.
  - `v1_execution_segment` count of `end_at IS NULL` is always 0 or 1.

### 23. Execution 中に Placement 名・Task・時間要件が変わる (USECASE.md:815-848, AUTO)

- **Domain structures**:
  - `v1_execution_basis` is a frozen snapshot. `v1_tile` / `v1_plan` updates don't propagate.
  - USECASE: "Basis (BasisValue[] + resolutionHash) を固定" — HARNESS §1-6.
- **UI controls**: `IdentityPanel` and `CompletionSubPanel` editable; the live Execution continues to display the snapshot.
- **Commands**: `POST /v1/tiles/{id}/update` for identity; `POST /v1/tiles/{id}/plan` for plan. Both bump `v1_tile.revision` and `v1_plan.revision`.
- **Worker/Read behavior**: `resolver` for the active Execution uses the cached basis; live tile reads see new values.
- **Observable evidence**:
  - `v1_execution_basis` unchanged in revision and content.
  - `v1_tile.revision` and `v1_plan.revision` bump.
  - GET `/v1/executions/{id}` shows the old `content.title` / `timeRequirements`.

### 24. Fact 修正・Task 取消・VOID 後の Metric (USECASE.md:850-885, AUTO)

- **Domain structures**:
  - `v1_execution_fact` rows appended; one can be revoked (NOT physical delete, v1/10 §6).
  - `v1_execution` VOID (state=3) does not delete; it is excluded from active Metrics.
  - `v1_metric` definitions compute on the read model; output is a snapshot (v1/05 §Metric, v1/07 §3).
- **UI controls**:
  - `MetricPanel` with `MetricDef.output = COUNT | DURATION | DECIMAL` and `expression` tree.
  - `TaskListEditor` "mark void" button.
- **Commands**:
  - `POST /v1/executions/{id}/facts` (create / revoke).
  - `POST /v1/executions/{id}/finish` with `state = FINISHED_VOID (3)`.
- **Worker/Read behavior**: Metric recomputes; voided rows are skipped.
- **Observable evidence**:
  - `v1_execution.state = 3` for voided.
  - `v1_execution_fact` rows preserved.
  - GET `/v1/metrics/{id}` output excludes voided facts.

### 25. 実行中 Execution がある Placement を close する (USECASE.md:887-922, AUTO)

- **Domain structures**:
  - `v1_placement.life.close = true` (v1/02:149).
  - The active Execution continues; `v1_execution_basis` keeps the old `placement_id`.
- **UI controls**: Timeline shows placement as "closed" but ExecutionPlayer still running.
- **Commands**:
  - `POST /v1/placements/{id}/changes` (CommandKind 28) with `key = (group=Span, item=placement_id, part=LIFE)` `kind = CLEAR (1)` — placement is closed.
  - Execution is untouched.
- **Worker/Read behavior**: timeline excludes closed placements from default view (state filter).
- **Observable evidence**:
  - `v1_placement.life.close = true`.
  - `v1_execution` and `v1_execution_basis` rows unchanged.

---

## D. 判断・自動調整 (USECASE 26-30) — DecisionRun, Session, Delivery, Feedback

### 26. 「睡眠不足」を専用状態なしで導出し、候補を比較する (USECASE.md:924-956, DECISION)

- **Domain structures**:
  - `v1_metric` with `output = DURATION` summing `v1_execution_segment` of `scope = REFERENCE` to "睡眠" Plan.
  - `v1_decision` (`v1/06:27-53`) with `candidates[]` for "increase sleep" plans.
  - v1/10 §9: no `sleepDebt` / `isTired` flag. Pure derivation.
- **UI controls**:
  - `MetricPanel` with MetricDef.
  - `DecisionPanel` lists candidates.
- **Commands**: `POST /v1/schedule-definitions` for the "睡眠" Plan; the `Plan` carries no flag. The metric is derived at read time.
- **Worker/Read behavior**: `metric_repo::evaluate` reads Execution + span; output is `CompletionResult`-style snapshot (v1/13 §3).
- **Observable evidence**:
  - `v1_plan` has no `isSleep` or similar column.
  - `v1_metric` output reads the value.
  - Decision candidates reference no dedicated sleep state.

### 27. 複数の未解決判断を 1 つの Session へ統合 (USECASE.md:958-997, DECISION)

- **Domain structures**:
  - `v1_decision_session` (HARNESS §5 2026-07-20 V1_047: workflow table, replaces bearer-token `v1_session` for delivery).
  - `v1_decision` + `v1_decision_run` aggregate.
- **UI controls**:
  - `DecisionPanel` shows one Session with multiple Decision cards.
- **Commands**: `POST /v1/sessions` (v1_decision_session create) bundles N candidates.
- **Worker/Read behavior**: server collects decision_runs, presents unified.
- **Observable evidence**:
  - `v1_decision_session` row with N `v1_decision_run` children.

### 28. Feedback 再利用は条件一致時だけ、取消後は使わない (USECASE.md:999-1037, AUTO)

- **Domain structures**:
  - `v1_feedback_txn` rows with `revoked = true` after cancellation.
  - `v1_decision.reuse[]` (v1/06) only matches non-revoked feedback.
- **UI controls**:
  - `DecisionPanel` shows "based on prior decision" with a link to the feedback txn.
- **Commands**: `POST /v1/feedback` (create), `POST /v1/feedback/{id}/revoke` (revoke).
- **Worker/Read behavior**: `feedback_repo::list_active` filters revoked out.
- **Observable evidence**:
  - Revoked feedback: `v1_feedback_txn.revoked = true`.
  - Reuse rule: only matches `revoked = false`.

### 29. 複数端末から REPLACE・MERGE・LOCKED 入力 (USECASE.md:1039-1090, DECISION / BLOCKED)

- **Domain structures**:
  - `v1_decision` `candidates[]` with `CandidateEffect.kind = PROPOSE_CHANGE | PROPOSE_PLACEMENT | REQUEST` (v1/06 §3).
  - REPLACE / MERGE / LOCKED are `MergeMode` on `ChangeSet` (v1/HARNESS: `OVERRIDE=0`, `INTERSECT_RANGE=1`, `UNION_IDENTIFIED=2`, `ORDERED_IDENTIFIED=3`, `SPAN_ENDPOINT=4`).
  - Multi-device conflict: `expectedRevision` rejects stale writers (HARNESS §1-7, v1/10 §4).
- **UI controls**:
  - `DecisionPanel` shows incoming peer devices and their effect kinds.
- **Commands**:
  - `POST /v1/placements/{id}/changes` from each device with `expectedRevision` and `mergeMode`.
  - Server returns `STALE_REVISION (2)` for the loser; the winner's effect is applied.
- **Worker/Read behavior**: optimistic concurrency + layer/rank precedence.
- **Observable evidence**:
  - One `v1_change_set` row per winner per key.
  - Loser device receives 422 with `kind = 2` (STALE_REVISION).

### 30. Delivery 一部失敗でも Session を複製せず、再試行する (USECASE.md:1092-1158, AUTO)

- **Domain structures**:
  - `v1_decision_session` + `v1_delivery` (HARNESS §5 2026-07-20 V1_046: workflow upgrade, AT for "Delivery 親が workflow table へ前方移行").
  - `v1_delivery.channel` is multi-target (mobile push, web push, email).
  - On partial failure, session is **not** cloned; `v1_delivery` rows are re-enqueued with `attempt_count++`.
- **UI controls**:
  - `DecisionPanel` shows "delivered to: web" + "pending: mobile".
- **Commands**:
  - `POST /v1/sessions` (create), `POST /v1/sessions/{id}/answer` (respond).
  - `POST /v1/deliveries/{id}/retry` (operator path).
- **Worker/Read behavior**: worker retries with backoff; success updates `v1_delivery.delivered_at`.
- **Observable evidence**:
  - `v1_decision_session` row count unchanged.
  - `v1_delivery` row count unchanged; `attempt_count` increments for failed channels.

---

## Conflicts between narrative docs and canonical v1

These are the places where `USECASE.md` or `SCHEDULE.md` use banned vocabulary or describe flows the v1 spec has explicitly superseded. They are also captured in `tile-create-e2e-wiring/01-domain-spec-fields.md:255-275` and `HARNESS.md §1-10 + §2 (項目 5)`.

| # | Source | Conflict | Canonical resolution |
|---|---|---|---|
| C1 | USECASE 02, 05, 06 wording "Recurring" | v1 forbids new `kind=RECURRING` writes (`command.rs:178-195`) | All new authoring uses `POST /v1/source-tiles` with `kind=SOURCE(3)` |
| C2 | USECASE 05, 15 "MANUAL placement" | `command.rs:252` says "legacy manual only"; new writes use SourceTile path | `placement_source = SOURCE(4)` for new writes (HARNESS `v0.5.3` commitment, v1/02:192) |
| C3 | SCHEDULE 3.1-3.6 semester labels as "labels" | v1 says LABEL is `Plan.role = LABEL (1)`, not a 4th Tile kind (v1/02:73-77) | "1学期" is a `Placement` with `Plan.role = LABEL`; not a `meta.semester` flag |
| C4 | SCHEDULE 2.3 "推奨条件" / "期限付き必須予定" | v1 has no such discriminated bucket; conditions live in `plan.completion.timeRequirements[]` and `windows[]` | Express as `Window(kind = CALENDAR) + TimeRequirement(required) + preferred: Target<ScalarValue>?` |
| C5 | SCHEDULE 2.3 "条件付き生成予定" wording | v1 says `SourceSchedule.generation.{weekday_mask, excluded_dates, ends_at, interval_ms}` only; no `Condition` on generation | Generation parameters go in `SourceSchedule`; the matching `Condition` lives in `plan.completion.root` (SCHEDULE §2.3 quoted in 01-domain-spec-fields.md:243-246) |
| C6 | SCHEDULE 3.3 夏季休暇 "自動生成しない" list | v1 has no `examWeekMode` / `holidaySchedule` / `studyBoost` flag (v1/00:339, v1/10 §10) | Express as `v1_window.kind = LABEL_SPAN(1)` referencing "夏季休暇" LABEL Placement; placement falls outside the window |
| C7 | SCHEDULE 2.4 "推奨条件を守れない場合" wording "予定を時間窓外へ黙って移動しない" | v1 says BLOCKED (6) returns violations to client (v1/14:64-83, USECASE echoed in 01-domain-spec-fields.md:250-252) | `ApiError.kind = 6 (BLOCKED)` with `violations[]`; client doesn't silently correct |
| C8 | USECASE 04 "Gap 生成済み休憩候補" "休憩" | v1/10 §9 + v1/00:339: no `isBreak` / `target_rest_min` discriminator | `休憩` is a Plan title; emit/skip via `GapTerm` + Flow candidate |
| C9 | USECASE 15 外部更新 vs ユーザー編集 layers | v1's `ChangeLayer` is 4-value (RECURRING=0, PLACEMENT=1, EXECUTION=2, SOURCE=3); IMPORT is a `PlacementSource`, not a `ChangeLayer` | External update bumps `v1_source_tile.revision` (V1_017); user's PLACEMENT-layer ChangeSet wins per layer precedence; old placements closed via `close_legacy_reflow_targets` |
| C10 | USECASE 21 "同じ Placement から同時に Execution" | v1's `ExecutionState` 4-value machine + at-most-1 ACTIVE invariant (HARNESS §1-6) | Second `StartExecution` returns ALREADY_APPLIED or CONFLICT, not 2 parallel Executions |
| C11 | USECASE 26 "睡眠不足" | v1/00:339 forbids `sleepDebt` / `fatigue` flag | Derived Metric on `v1_execution_segment`; no flag column anywhere |
| C12 | SCHEDULE 26 "外部情報が確定するまで生成しない予定" | v1: same as C6 (no `holidaySchedule` flag) | `Window(kind = LABEL_SPAN)` referencing the "確定情報" LABEL; absence of LABEL means window doesn't open |
| C13 | USECASE 22 異常順序 "Pause when FINISHED" | v1 HARNESS §1-6 + v1/02 §Execution state machine | Returns 409 with `kind=5` (CONFLICT); invariants enforced in command handler |
| C14 | SCHEDULE 3.5 "テスト本番日" | v1: test days are LABEL `Plan.role = LABEL` Placements; no `examWeekMode` flag | "テスト本番" is a LABEL Span; CALENDAR Window with holiday flag handles "試験時間割" |
| C15 | SCHEDULE 25.10 "土曜日" all-day anchors | v1 has no special Saturday handling; expresses via `CalendarTerm.weekdayMask = 0b0100000` (Sat) | CALENDAR Window + weekday mask only |

These are not defects in USECASE/SCHEDULE — they are scaffolding documents from before v1 era that the current `tile-create-e2e-wiring/01-domain-spec-fields.md:255-275` table has already enumerated. The decomposition above maps each USECASE scenario to **only the canonical v1 surface** so implementers don't accidentally pick up the banned vocabulary.

---

## Banned vocabulary to actively reject (per v1/00:325-339 + HARNESS §1-10 + memory `feedback_no_fragmented_reimplementations.md`)

```
v7_tiles, v7_intent_nodes, v7_demand_templates, v7_condition_atoms
6軸 enum (Measure/Trigger/Domain/Transform/Satisfaction/Propagation)
TickOutput, TickResult, TickResultEffects
Projector, Compiler, DemandGenerator, Solver, Materializer, Arbiter, RuntimeController
PlacementScore (11 fields), NoActionReason (6 variants)
isMovable, isFixed, isOverlapAllowed, weekdayOnly, recordingPolicy
sleepDebt, fatigue, breakMode, examWeekMode, holidaySchedule, napRule, studyBoost
target_rest_min, rest_mode
isBreak, isLabelOnly
completed: boolean on Plan/Placement/Execution
metadata_json / condition_json / payload_json in source-of-truth tables
weekdayOnly / holidaySkip flags
completed_at / started_at / status on Tile
is_today, is_due, is_overdue on Placement
```

If any scenario in §A-§D above (or in a future scheduling authoring path) seems to require one of these, **stop** and re-read `v1/10-invariants.md` before writing the wire.

---

## Implementation order implied by this decomposition

This tree, together with `tile-create-e2e-wiring/05-impl-order.md`, gives the implementation order. Sub-projects A-F map onto the judgment classes as follows:

| Sub-project | USECASE scenarios | Phase | Risk |
|---|---|---|---|
| G stack-up + H auth-bridge | all (enables e2e) | 0 | low (already scaffolded per `wslc` HARNESS §5 2026-07-16) |
| A Tile + Plan | 13, 14, 23, 24 | 1 | wire ✓, e2e plumbing + V1_014 NOT NULL regression (HARNESS §5 2026-07-08) |
| B Time + Windows | 01, 04, 16, 17, 18, 19, 20 | 1 | wire ✓, e2e plumbing |
| C Recurring + Source | 02, 03, 12, 14, 15 | 1 | wire ✓, conflict C1 + C2 + C9 |
| D Frame rules + §6 Advanced | 08, 11, 29 | 2 | wire throw at `quick-create-schedule-wire.ts:249-257` + `:246-248` |
| F Meta project + tags | 14 (metadata persistence) | 2 | wire throw at `:240-242`; no Project/Tag entity in v1/02 (gap-matrix pending) |
| E Condition AST editor | 04, 05, 06, 10, 13, 26, 27, 28 | 3 | largest UI surface; depends on A/C/D stable |

---

## Source line index (for verifier)

- USECASE scenarios 01-30 headers: `tastile-core/docs/USECASE.md:23,53,85,124,159,195,229,263,299,334,376,409,453,497,533,568,606,641,676,707,745,781,815,850,887,924,958,999,1039,1092`
- SCHEDULE structure: `tastile-core/docs/SCHEDULE.md:1,22,24,40,102,114,129,131,139,147,165,171,187,206,208,221,233,248,266,280,292,308,324,337,339,352,364,368,380,388,418,446,472,482,498,512,520,533,550,560,576,592,611,621,633,650,669,671,683,693,704,715,740,758,760,771,783,795,797,805,816,827,836,848,859,881,899,913,925,970,972,1007,1011,1024,1047,1060,1070,1085,1091,1113,1115,1131,1149,1161,1177,1190,1207,1209,1215,1229,1244,1250,1256,1258,1273,1279,1293,1340,1346,1362,1387,1393,1399,1411,1419,1430,1451,1474,1476,1499,1509,1515,1521,1529,1533,1539,1545,1551,1557,1563`
- v1 spec files: `tastile-core/v1/{00..15}-*.md` (16 files; indices in `tastile-core/v1/HARNESS.md`)
- v1 numeric constants: `tastile-core/v1/HARNESS.md` (registry table)
- v1 endpoint table: `tastile-core/v1/14-read-model-and-endpoint.md` + `tastile-core/crates-v1/api/src/main.rs:258-710` (152 entries)
- Domain source-of-truth payload structs: `tastile-core/crates-v1/domain/src/command.rs:1-340`, `source_schedule.rs:1-200`, `completion.rs`
- Auth + envelope: `tastile-core/crates-v1/api/src/handlers/common.rs:733-823` (bearer_auth_result + authenticate fall-through, HARNESS §5 2026-07-22)
- QuickCreate wire + throw sites: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:213-450` (lines 240-242 / 246-248 / 249-257 / 263-268)
- E2E plumbing: `tastile-web/e2e/quick-tile-create-e2e.spec.ts:1-60`, `tastile-web/e2e/helpers/v1.ts:1-160`
- Worker / read path: `crates/v1/storage/src/frame_repo.rs` (lazy_expand_owner_window, list_owners_with_active_recurring, plan_step_occurrences), `crates/v1/storage/src/condition.rs` (evaluate_for_occurrence), `crates/v1/storage/src/flow_tick.rs` (evaluate_window), `crates/v1/worker/src/main.rs` (drive_fill), `crates/v1/api/src/handlers/timeline.rs` (lazy_expand_owner_window loop)

Field-row count: 30 scenarios × 5 axes = 150 decomposition rows + 15 conflict rows + 1 banned-vocabulary list + 1 implementation-order table. No invented fields; spec-silent positions are flagged in §0 (cross-cutting tree) and inline ("**silent**").
