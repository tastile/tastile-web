# E7a — ConditionEditor shared refactor (completion + FrameRule.active)

## メタデータ

- **ID**: E7a
- **Phase**: 4 (deferred until E1b is in)
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree)
- **Depends on**: E2a (ConditionEditor single-slot component), E1b (`recurring.condition` wire slot extension into `FrameRule.active`)
- **Sibling plans**: none
- **Source spec**: `04-sub-projects/E-condition-tree.md` §8 リスク ("Reusing the Condition editor between `plan.completion.root` and `FrameRule.active` requires shared component, not copy-paste")

## 前提

- E2a is green — `src/features/create-tile/ui/ConditionEditor.tsx` exists as a single-slot editor driven by `plan.completion.root`. Property test from E4a covers ser/de round-trip on that slot.
- E1b is merged — `PublishScheduleDefinitionPayload` carries `condition` as `FrameRule.active` (`tastile-core/v1/08-recurring-and-frame.md:54`) on the Recurring envelope. `quick-create-schedule-wire.ts` emits it; core's `POST /v1/schedule-definitions` accepts it (per E1b spec).
- The Condition AST shape used by both slots is byte-identical to `crates-v1/domain/src/condition.rs` per E2a's shared serialiser.
- Property test `e2e/condition-tree-basic.spec.ts` (per E2a) currently drives `plan.completion.root` only.

## 目的

Single `ConditionEditor` component drives **both** `plan.completion.root` (`tastile-core/v1/13-completion.md:11`) **and** `recurring.condition` (the wire slot added by E1b that lands in `FrameRule.active` at `tastile-core/v1/08-recurring-and-frame.md:54`). No copy-paste. Property test from E4a extended to cover both slots from one component instance per render path. Acceptance check from E2a (`build both completions; submit; both payloads reach core`) holds for both slots.

## 受入条件

- `ConditionEditor` accepts a `slot: 'completion.root' | 'recurring.condition'` prop (or resolves it from a panel-level context — see §実装手順 choice). A single component definition is referenced from both §2 Plan and §5 Recurring panels.
- Spec `e2e/e7a-shared-condition.spec.ts` green: open panel, set §2 Plan completion = `{ALL: [timeReq, taskRef]}`, set §5 Recurring `condition` = `{ANY: [ref, gapTerm]}`, submit. Both payloads reach core.
- `psql` JSON query against `v1_plan.completion_root` and `v1_recurring_frame_rule.active` (verified on the wslc-side `tastile-v1-api:latest` from G1a + `tastile-db` from G6a) confirms both slots populated and structurally distinct (per-operator distinct `op` integer).
- E2a's existing `e2e/condition-tree-basic.spec.ts` still green (refactor must not regress E2a's single-slot coverage).
- E1b's wire extension test (`e2e/recurring-condition-wire.spec.ts` or equivalent per E1b) still green.
- No new core migration is needed; AST shape is shared and was serialised into both payloads by E2a + E1b independently.

## 実装手順

1. **Read the E2a component definition** at `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx` to confirm the prop shape E2a settled on. If E2a's API already takes a generic `path: ConditionSlotPath` or similar (preferred per the source spec's "shared, not copy-paste" requirement), skip to step 3. If it takes a hard-coded `completion.root` prop, do step 2.

2. **Refactor `ConditionEditor`** to accept a slot discriminator. Two options:
   - **(a) Explicit prop** — `slot: 'completion.root' | 'recurring.condition'`. Easier to type, no React Context plumbing. Choose this unless a third slot lands soon.
   - **(b) Context-driven** — `<ConditionEditorProvider slot={...}>` wrapping each panel, `ConditionEditor` reads slot from context. More flexible if a third slot is planned (Task `complete` from E3d — `v1/13:122-180` TaskDefinition.complete also reuses this editor per `04-sub-projects/E-condition-tree.md:32`).
   - Recommendation: (a) for E7a. Migrate to (b) when TaskDefinition.complete lands (separate plan, not in scope here).

3. **Wire into §2 Plan panel** (`tastile-web/src/features/create-tile/ui/panels/PlanPanel.tsx`):
   - Replace the existing direct `<ConditionEditor />` invocation with `<ConditionEditor slot="completion.root" value={plan.completion.root} onChange={...} />`.
   - The existing call site in E2a should already be on this path; this step is a no-op if E2a already took `slot` as a prop.

4. **Wire into §5 Recurring panel** (`tastile-web/src/features/create-tile/ui/panels/RecurringPanel.tsx`):
   - Add `<ConditionEditor slot="recurring.condition" value={recurring.condition} onChange={...} />` to the panel body.
   - Source: `tastile-core/v1/08-recurring-and-frame.md:54` (`active: Condition | null`) — `null` means no condition (FrameRule always active); non-null drives Frame generation per `FrameRule.active`.
   - The `recurring.condition` value lives in the `quick-create-store` slice (per E1b step 4); the panel's `onChange` writes back to that slice.

5. **Slot-specific validation differences** (handle in component, not at call sites):
   - Per `04-sub-projects/E-condition-tree.md:21-25`, both slots share the 6 Term kinds (Reference / Metric / Time / Task / Gap / Calendar from `v1/05:40-52`).
   - **Known difference** (the §8 risk line that this plan addresses): `recurring.condition` runs at Frame-evaluation time (`v1/08:54`), where `Term::Task` references are not yet materialised — i.e. `Term::Task { task_id }` may be valid in `completion.root` (post-materialisation) but undefined in `recurring.condition` (pre-materialisation). E2a's editor should already accept any Term; the refactor adds a soft warning when `slot === 'recurring.condition'` and the AST contains `Term::Task` (warning chip next to the term, not a hard block — `crates-v1/domain/src/condition.rs` will resolve it as `false` either way). Hard validation of Term::Task pre-materialisation belongs in core's AST evaluator (separate concern, separate plan).
   - No other Term kind is slot-specific at this revision.

6. **Property test extension** (`tastile-web/e2e/e7a-shared-condition.spec.ts`):
   - Reuse the same Playwright fixtures as E2a's `e2e/condition-tree-basic.spec.ts` (panel boot, store hydration, submit button).
   - Build `{ALL: [timeReq, taskRef]}` in §2 Plan's ConditionEditor.
   - Switch to §5 Recurring (drawer/section swap per the QuickCreate M3 BottomSheet composition from `feedback_quickcreate_stacked_m3_sheets.md`).
   - Build `{ANY: [ref, gapTerm]}` in §5 Recurring's ConditionEditor.
   - Submit. Expect 200 from `POST /v1/schedule-definitions` (per E1b's wire extension).
   - Assert the response shape contains both `plan.completion.root` and `frame_rule.active` carrying the expected `op` integers (ALL = 0, ANY = 1 from `v1/05:11-32`).
   - psql assertion: `SELECT jsonb_path_query_array(completion_root, '$.op') FROM v1_plan WHERE ...` and `SELECT jsonb_path_query_array(active, '$.op') FROM v1_recurring_frame_rule WHERE ...` both return `[0]` and `[1]` respectively.

7. **Remove any duplicate editor** that E2a may have left in the Recurring panel as a placeholder (per E2a's deferred-§5 footprint). One component, two call sites.

## 検証手順

```bash
# 1. Playwright spec green
cd tastile-web
bun run test:e2e -- e2e/e7a-shared-condition.spec.ts
# 期待: 1 spec, all assertions pass

# 2. Regression: E2a's single-slot spec still green
bun run test:e2e -- e2e/condition-tree-basic.spec.ts
# 期待: pass (refactor must not break E2a's coverage of completion.root alone)

# 3. Regression: E1b's wire extension spec still green
bun run test:e2e -- e2e/recurring-condition-wire.spec.ts
# 期待: pass (wire extension unchanged)

# 4. Web typecheck + lint
bun run typecheck
bun run lint
# 期待: exit 0

# 5. DB-level JSON assertions (wslc Postgres per G1a + G6a)
wslc container exec tastile-db psql -U tastile -d tastile_db -c "
  SELECT
    (SELECT jsonb_path_query_array(completion_root, '\$.op') FROM v1_plan
       WHERE owner_id = '$OWNER' ORDER BY created_at DESC LIMIT 1) AS plan_root_op,
    (SELECT jsonb_path_query_array(active, '\$.op') FROM v1_recurring_frame_rule
       WHERE recurring_id IN (SELECT id FROM v1_recurring WHERE owner_id = '$OWNER')
       ORDER BY created_at DESC LIMIT 1) AS frame_rule_active_op;
"
# 期待: plan_root_op = [0] (ALL), frame_rule_active_op = [1] (ANY)

# 6. Component-level unit test (Vitest): both slots produce distinct AST output from identical input structure
bunx vitest run src/features/create-tile/ui/ConditionEditor.test.tsx
# 期待: pass (renders for both slot prop values without TypeError or undefined-prop fallout)
```

## リスク

- **Refactor regresses E2a** — E2a's existing `e2e/condition-tree-basic.spec.ts` may depend on the E2a prop shape. Mitigation: keep the E2a prop name (`value` / `onChange`) and add `slot` as additive. If E2a already takes `slot`, this plan is a 2-line change.
- **Refactor regresses E1b** — E1b's wire spec may exercise the Recurring panel's condition input as a plain textarea / numeric input. If E2a shipped a placeholder input that E1b relied on, replacing it with `ConditionEditor` could change the wire payload shape. Mitigation: E1b must be merged first; this plan only runs after E1b is green, so the wire shape is already validated against whatever placeholder existed.
- **Slot-specific validation may differ** — `recurring.condition` runs pre-materialisation (Frame evaluation), `completion.root` runs post-materialisation (Plan execution). Term::Task is well-formed only in the latter. E2a's editor accepts any Term shape uniformly; this refactor does NOT add hard validation. The component emits a soft warning chip when `slot === 'recurring.condition'` and the AST contains `Term::Task`. Hard validation belongs in `crates-v1/domain/src/condition.rs` and is out of scope here.
- **Property test combinatorial explosion** — building 2 distinct ASTs in one spec keeps it small. If the test grows beyond 2 slots/2 operators, split per E-condition-tree.md:55 recommendation (property-based test matrix).
- **Context vs explicit-prop decision** — picking `(a)` explicit prop now is cheap to migrate to `(b)` later when TaskDefinition.complete lands. The cost of picking `(b)` now is React Context plumbing for only 2 call sites. Recommendation locked to `(a)`; document the migration trigger (third slot request).

## 関連

- `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §3 (Condition AST editor scope), §8 (this plan's source risk)
- `tile-create-e2e-wiring/04-plans/E2a-condition-ast-editor-component.md` (single-slot component, single source of truth)
- `tile-create-e2e-wiring/04-plans/E1b-condition-wire-slot-extension.md` (wire payload extension enabling the second slot)
- `tile-create-e2e-wiring/04-plans/E4a-*` (property test that E2a introduced; E7a extends it)
- `tile-create-e2e-wiring/04-plans/E3d-task-definition-editor-component.md` (downstream consumer — TaskDefinition.complete will reuse the same editor with a third slot in a separate plan)
- `tastile-core/v1/05-condition-and-reference.md` — Condition AST shape (ALL=0, ANY=1, NOT=2, TERM=3 operators at §11-32; 6 Term kinds at §40-52)
- `tastile-core/v1/08-recurring-and-frame.md:54` — `FrameRule.active: Condition | null`
- `tastile-core/v1/13-completion.md:11` — `Plan.completion.root`
- `tile-create-e2e-wiring/05-impl-order.md` — E7a ordering (after E2a + E1b; before any E3 task that consumes the editor)
- `tile-create-e2e-wiring/00-overview.md` — sub-project index