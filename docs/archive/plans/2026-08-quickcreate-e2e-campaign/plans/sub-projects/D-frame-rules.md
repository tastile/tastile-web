# D — Frame Rules / Change Sets / Plan Flows

## 目的 (Purpose)

Resolve the three throw sites at `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:246-257` that abort `submitCreateTile` when §6 Advanced, §5 Recurring legacy, or §2 Plan-level flows are populated. Default-state submissions are unaffected; the throws exist to prevent silent data loss for fields that aren't reaching core. Each throw site gets one of three resolutions: **Remove** (silent drop + UI tag), **Demote** (move to hidden/read-only panel), or **Implement** (extend wire to reach core).

## Throw site analysis

### A. `advanced.changeSets[]` / `advanced.rules[]` (lines 246-248)

These represent **ChangeSet** objects per `tastile-core/v1/04` (`Key(group, item, part) + value`). ChangeSets are the wire protocol for *editing existing aggregates*, not initial creation — they route through `/v1/tiles/{id}/plan` (`command.rs:241`) or `/v1/source-tiles/{id}` (PUT, `command.rs:212`). The atomic `SourceScheduleDefinition` envelope (`v1/02:321-328`, `v1/14:419-428`) has no ChangeSet slot. Submitting them at create time would create an inconsistent state where the initial revision carries unscheduled changes.

**Resolution: Remove.** The §6 Advanced section is already explicitly marked Phase D stub in `QuickCreate.tsx:21-23`. Keep the UI controls visible but make submission a silent no-op; tag the section header "Phase D — ChangeSet editing arrives via edit-mode flow."

### B. `recurring.frameRules[]` / `recurring.rules[]` (lines 249-251)

These map to **FrameRule** (Step / Reference / Calendar / Transform generator — `v1/02:104`, `v1/08:47-103`) and **RecurringRule** (when/rank/outputs — `v1/02:105`, `v1/08:156-162`). The Recurring aggregate itself is **deprecated read-only** per `v1/02:190-192` ("v0.5.3 以降の commitment") and `v1/08:236`. `quick-create-schedule-wire.ts:362` already hardcodes `recurrence: null` — the create path encodes recurrence via `source_schedule.generation.*` instead (sub-project C). The §5 frameRules/rules UI controls are vestigial.

**Resolution: Demote.** Remove the controls from the create panel entirely; remove the store slice fields. Equivalent functionality lives in `recurring.repeatMode / weekdayMask / intervalValue/Unit` (§5 Recurring core) which already reach core via `source_schedule.generation.*` (sub-project C).

### C. `plan.planning.flows[]` (lines 252-257)

Flow objects per `v1/02:63`. The wire slot already exists — `flows: [{observes, when, candidates}]` is part of `PublishScheduleDefinitionPayload` (`02-ui-coverage-audit.md:127`). Today only `source.flowSequences[]` populates it (atomic flow); `plan.planning.flows[]` (Plan-level legacy flow) is rejected. Both should produce the same Flow shape.

**Resolution: Implement.** Merge `plan.planning.flows[]` into the same `flows[]` array as `source.flowSequences[]` at wire-builder time. Verify with one curl that the merged payload is accepted.

## 変更手順 (Change steps)

1. **A**: In `quick-create-schedule-wire.ts:246-248`, replace the throw with `if (state.advanced.changeSets.length > 0 || state.advanced.rules.length > 0) { /* Phase D — see §6 Advanced UI tag */ }` (no-op). Update `QuickCreate.tsx:21-23` header to clarify §6 is view-only.
2. **B**: Delete `frameRules[]` / `rules[]` from `quick-create-store.ts` (§5 slice). Remove the corresponding UI controls in `QuickCreate.tsx` (grep `frameRules\|recurring.rules` to locate). Delete the throw at `quick-create-schedule-wire.ts:249-251`. The §5 Recurring core fields (`repeatMode / weekdayMask / intervalValue/Unit / life.active`) remain and feed `source_schedule.generation.*` (sub-project C).
3. **C**: In `quick-create-schedule-wire.ts:252-257`, replace the throw with `flows: [...state.source.flowSequences, ...state.plan.planning.flows]`. Validate each Plan flow against the wire shape (`observes: string[]` non-empty, `steps: { emitDurationMs > 0 }`). One curl against `POST /v1/schedule-definitions` to confirm core accepts.

## e2e 検証 (Verification)

`e2e/quick-tile-create-subproject-d.spec.ts` (new):

- **A**: Open QuickCreate, fill §6 Advanced changeSet, submit. Assert no throw. Assert `SELECT count(*) FROM v1_change_set WHERE tile_id = ?` returns 0. Assert UI surfaces "Phase D" tag near §6 header.
- **B**: Assert §5 frameRules/rules controls are no longer in the DOM (`page.locator('[data-testid*=frame-rule]')` → 0).
- **C**: Fill both `source.flowSequences[]` (1 flow, 2 steps) and `plan.planning.flows[]` (1 flow, 1 step), submit. Assert no throw. Assert merged count reaches core via `GET /v1/tiles/{id}` view (flow count = 2).

## リスク (Risks)

- **A** — User confusion: "I filled §6 and nothing saved." Mitigate with visible "Phase D" tag + tooltip pointing at edit-mode.
- **B** — Data loss for any local state with frameRules/rules. Migration: discard silently (no-op is acceptable since Recurring is read-only deprecated anyway).
- **C** — Core may reject Plan-level flows in the atomic envelope. Mitigation: pre-verify with one curl (step 3 above); if rejected, fall back to Demote (treat as A — silent drop).

## オープン質問 (Open questions)

1. **A**: Confirm §6 Advanced stays visible (Remove) vs hidden (Demote) until Phase D.
2. **B**: Confirm frameRules/rules can be deleted from the store outright, vs leaving a "Deprecated — moved to SourceSchedule" tombstone for users with existing local state.
3. **C**: If core rejects the merge, fall back to Demote (`plan.planning.flows[]` treated as legacy no-op) or to Remove (delete the §2 Plan-level flow controls)?

---

References: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:213-450` (wire builder), `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:1-660` (panel), `tastile-web/src/shared/stores/quick-create-store.ts` (state shape), `tastile-core/v1/02-core-entities.md` (entities), `tastile-core/v1/04` (ChangeSet), `tastile-core/v1/08-recurring-and-frame.md:47-103` (FrameRule), `tastile-core/v1/08:156-162` (RecurringRule), `tastile-core/v1/02:190-192` (Recurring deprecation), `tastile-core/crates-v1/domain/src/command.rs:178-340` (write payload structs).