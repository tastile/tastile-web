# F — Meta Attrs (Project / Tags)

## 1. 目的 (Purpose)

Resolve the THROW site at `quick-create-schedule-wire.ts:240-242` so that user input in the §7 Meta project + tags controls does not break submission. The atomic `SourceScheduleDefinition` envelope has no slot for these fields; the wire builder blocks on them. This sub-project proposes the demotion resolution and lists its alternative cost.

## 2. 現状分析 (Current state)

- **UI**: `tastile-web/src/features/create-tile/ui/MetaSubPanel.tsx` exposes a project picker (`meta.project`) and a tag list (`meta.tags[]`). `QuickCreate.tsx:491` renders `meta.tags.map((tag) => …)` chips. `QuickCreate.tsx:1018` mounts `<MetaSubPanel>` inside the shell.
- **Wire throw**: `quick-create-schedule-wire.ts:240-242` — `if (state.meta.project || state.meta.tags.length > 0) throw new Error("projects and tags are not supported by atomic schedule publish");`. Blocked BEFORE envelope construction (`publishScheduleDefinition` at `schedule-definition.ts:212`).
- **Domain gap**: `v1/02-core-entities.md` defines no `Project` or `Tag` entity on Tile, Plan, or any aggregate. No endpoint exists at `crates-v1/api/src/main.rs:258-710` for `/v1/projects` or `/v1/tags`. Confirmed by gap matrix row "Project / Tags (n/a)".
- **State**: `quick-create-store.ts` holds `meta.project: string|null` and `meta.tags: string[]`; both reset to empty in the default state.

## 3. 選択肢 (Options)

| Option | Cost | UX impact | Domain surface |
|---|---|---|---|
| **Remove** — delete the controls | Low (1 file + audit) | Users lose the input affordance; no recovery path | None |
| **Demote (Recommended)** — keep controls, mark "Phase E", drop at submit | Low–Medium (wire + UI copy + e2e) | Users see input is collected but unrepresented; honest affordance | None |
| **Implement** — add `POST /v1/tiles/{id}/project` + `…/tags` | High (core change + Rust handler + DDL + migration + web wire) | Full persistence; matches UI | Significant |

**Recommendation: Demote.** Rationale: matches user intent ("実際に繋ぐ" = wire what core supports, leave deferred items explicit), zero domain surface, reversible. Aligns with the explicit throw comment ("not supported by atomic schedule publish").

## 4. 変更手順 (Change steps)

1. **Replace throw with silent drop** at `quick-create-schedule-wire.ts:240-242`: remove the throw block; comment to record that project/tags are accepted in UI but not represented in the atomic envelope (Phase E).
2. **Add warning affordance** in `MetaSubPanel.tsx`: when `meta.project.trim() || meta.tags.length > 0`, render a small `<Badge color="yellow">Phase E — not yet persisted</Badge>` next to the input. Use existing `badge`-style components in `src/components/ui/`.
3. **Audit other call sites**: grep `state.meta.project` and `state.meta.tags` across `tastile-web/src/` to ensure no other code path expects non-empty values (none expected per the gap matrix).
4. **Update `submit.ts` error path** to no longer reference project/tags as a known failure mode.

## 5. e2e 検証 (Verification)

Extend `tastile-web/e2e/quick-tile-create-e2e.spec.ts` with one new test case:
- Fill §7 Meta project="MyProject", tags=["work"].
- Click submit. Expect submission to succeed (no toast error).
- Assert `Phase E` badge appears in DOM (`getByText(/Phase E/)`).
- `wslc container exec tastile-db psql -tAc "SELECT count(*) FROM v1_tile"` after submission = 1 (tile persisted; project/tags dropped).

## 6. リスク (Risks)

- **User input loss**: user types a project name, sees "saved", reloads — the data is gone. Mitigation: explicit "Phase E — not yet persisted" badge makes this honest.
- **Migration debt**: if core later adds Project/Tag endpoints, this code must be revisited. Acceptable since gap matrix already tracks this.
- **No "Implement" path tested**: if the user later picks Implement, the demotion work is thrown away. Low cost; 1 file + 1 UI copy change.

## 7. オープン質問 (Open questions)

User must confirm before implementation:
1. **Demote vs Remove vs Implement?** Demote is recommended. The "Implement" path requires `tastile-core` work outside this wiring effort.
2. **Badge copy**: "Phase E — not yet persisted" or simpler "Not saved yet"? Pick on confirm.
3. **Should `submit.ts:62-63` Phase B comment be updated** to also reference Phase E for project/tags? Yes if demote, no if remove.