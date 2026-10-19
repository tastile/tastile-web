# E — Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors

Largest sub-project. Resolves the `recurring.condition` silent drop (`01-domain-spec-fields.md` — `FrameRule.active` at `v1/08:54`, `v1/05`) and surfaces the editors that the QuickCreate panel currently lacks for `Plan.completion`, `Plan.metrics[]`, `Plan.decisions[]`.

## 1. 目的

Make the Condition AST, TimeRequirement, TaskDefinition, Metric, and Decision editors actually editable in the QuickCreate panel — and make the data round-trip into core's `POST /v1/schedule-definitions` payload without being silently dropped at the wire builder. Without this sub-project, the panel is functionally a stub for any tile whose completion / gating logic depends on anything beyond the defaults.

## 2. 最小対応 — `recurring.condition` silent drop fix

Current state: `quick-create-schedule-wire.ts` has no `condition` slot in `PublishScheduleDefinitionPayload`; the `recurring.condition` UI field (`02-ui-coverage-audit.md` §5) reads but never emits.

Two options:
- **A. Remove UI affordance** — disable / hide the field; add a `console.warn` or store-level flag that signals "Phase C/D reserved". Cheap, removes ambiguity.
- **B. Add wire slot** — extend the wire payload to carry `condition` as `FrameRule.active` (`v1/08:54`), serialised via the same Condition AST shape used by `Plan.completion.root`. Requires core to accept `condition` on the SourceScheduleDefinition envelope (`source_schedule.rs:11-119`); may require a small `source_schedule.rs` patch + `crates-v1/domain/src/command.rs` extension.

**Recommendation**: A for this sub-project (Phase 1 e2e), B deferred to a Phase 4 expansion. Justification: per `00-overview.md` scope, this sub-project is "largest" — fixing the silent drop without the full AST editor is incoherent.

## 3. 拡大対応 — Condition AST editor

If pursued:
- Editor component: 4 operators (ALL / ANY / NOT / TERM — `v1/05:11-32`) with nested term selector for 6 Term kinds (Reference / Metric / Time / Task / Gap / Calendar — `v1/05:40-52`).
- Persistence: `plan.completion.root` (`v1/13:11`) already wired; `FrameRule.active` (the `recurring.condition` slot) requires the wire extension in §2-B.
- Files: new `src/features/create-tile/ui/ConditionEditor.tsx`; add to `quick-create-store.ts` slice; new wire helpers in `quick-create-schedule-wire.ts`.
- AST serialiser: shared between `plan.completion.root` and `FrameRule.active`. Use the same Rust shape as `crates-v1/domain/src/condition.rs`.

## 4. 拡大対応 — TimeRequirement + TaskDefinition editors

Currently collapsed to a single default `{required: 30-90min}` and a single `"Mark done"` task (`02-ui-coverage-audit.md` §2).

- **TimeRequirement** (`v1/13:60-92`): observation.scope (5-valued), observation.source (3-valued), observation.aggregate (5-valued), observation.quantifier (2-valued, conditional), required (Range), preferred (Target). Editor = 5-6 controls per requirement; allow 0-N requirements.
- **TaskDefinition** (`v1/13:122-180`): content (title/description), show (Condition?), complete (Condition — reuses editor from §3), order[] (TaskOrderRule). Editor per task.

## 5. 拡大対応 — Metric + Decision editors

- **Metric** (`v1/05:194-230`): output (5-valued: LITERAL / READ / AGGREGATE / OPERATE / CHOOSE), expression (ScalarExpression), limit (Range). `plan.metrics[]` today only carries UUIDs — no editor exists.
- **Decision** (`v1/06`): full decision tree editor. Same scope as Condition editor but larger; references `plan.decisions[]`.

## 6. e2e 検証

- `e2e/condition-tree-basic.spec.ts`: open panel, build `{ALL: [timeReq, taskRef]}`, submit, observe `plan.completion.root` row in `v1_plan` via `GET /v1/timeline`.
- `e2e/time-requirement-editor.spec.ts`: add 2 timeReqs with different observation shapes; assert payload.
- `e2e/task-definition.spec.ts`: 2 tasks, assert `complete` Condition shape.
- `e2e/metric-decision.spec.ts`: 1 metric, 1 decision; assert `plan.metrics[]` / `plan.decisions[]` non-empty.
- Each spec uses the wslc-ised TRUNCATE from sub-project G.

## 7. スコープ外

Reference editor (target EXACT/SERIES/FILTER/CONTEXT × pick ALL/FIRST/LAST/BEFORE/AFTER — `v1/05:121-167`), ChangeSet editor (`v1/04`), Attachment uploader. Tracked under separate sub-projects if user requests.

## 8. リスク

- Largest UI surface area in the tree — five editors in one sub-project.
- AST serialisation must stay in lock-step with `crates-v1/domain/src/condition.rs`; bump risk on either side.
- Test matrix explodes combinatorially (operator × term × context). Recommend property-based tests for the AST ser/de round-trip.
- Reusing the Condition editor between `plan.completion.root` and `FrameRule.active` requires shared component, not copy-paste.

## 9. オープン質問

- Split this sub-project into E1 (Condition + recurring.condition fix), E2 (TimeRequirement + TaskDefinition), E3 (Metric + Decision)?
- Or attempt all five editors in one PR?
- For the `recurring.condition` fix in §2 — pick A (remove) or B (wire)?