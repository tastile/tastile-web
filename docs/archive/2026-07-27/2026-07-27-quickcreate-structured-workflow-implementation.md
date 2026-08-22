# QuickCreate Structured-Task Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make QuickTileCreate support structured task notes, per-task completion conditions, and task ordering/dependencies through progressive disclosure while preserving the existing main-panel/sub-panel slide mechanism.

**Architecture:** Keep `QuickTileCreate`'s existing shell, `panelClass`/`subPanelClass` positioning, panel keys, and Zustand ownership model. Add a `task` sub-panel that edits one task by UUID, render tasks as compact summary rows inside a collapsible staged section, and route every task mutation through the store. Keep the store's internal `content.note` compatibility shape; `plan-wire.ts` continues translating it to API `content.description`.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand, Mantine, Vitest, Testing Library, Chrome DevTools MCP.

---

### Task 1: Add pure task graph and task mutation helpers

**Files:**
- Modify: `tastile-web/src/lib/stores/quick-create-store.ts`
- Modify: `tastile-web/src/lib/stores/quick-create-store.test.ts`
- Modify: `tastile-web/src/lib/domain/v1/completion.ts` only if the existing `Content.note` typing needs a compatibility alias; do not change wire conversion here.

**Step 1: Write failing store tests**

Add tests for the store contract:
- a newly added task has a UUIDv7 id, `{ title: "", note: null }`, a manual-check completion condition, and `order: []`;
- task updates resolve by task id rather than array index, including `completion.tasks.<id>.content.note` and `completion.tasks.<id>.complete`;
- deleting a task removes that task and every sibling order rule targeting it;
- a two-node order cycle is invalid and an acyclic graph is valid;
- empty-title tasks are omitted from the submitted task snapshot while titled tasks retain note/completion/order.

Export pure helpers if needed (`hasTaskOrderCycle`, `removeTaskAndDanglingOrders`, or equivalent) so graph behavior is unit-testable without mounting React.

**Step 2: Run the focused tests and verify failure**

Run from `tastile-web`:

```bash
bun test src/lib/stores/quick-create-store.test.ts
```

Expected: FAIL because the current store has no id-aware task operations/graph validation and its default task/add path does not satisfy the new shape.

**Step 3: Implement the minimum store behavior**

- Add a UUIDv7-backed task factory. Use the existing UUID utility used by the web client; do not use array indexes or random non-UUID identifiers for new persisted task ids.
- Add task-specific actions (for example `addTask`, `removeTask`, `updateTask`, and `setTaskField`) to `QuickCreateState`, or implement an equivalent id-aware branch in `setField`. The accepted logical paths must be `completion.tasks.<taskId>...` as documented by the design.
- Preserve immutable Zustand updates and existing top-level dotted paths.
- Use the existing numeric condition constants. A new task's default completion must represent manual-check, not a stored runtime completion boolean.
- Add cycle detection over `TaskOrderRule.targetTaskId`; interpret relation `BEFORE` and `AFTER` consistently as directed edges, and ignore deleted/dangling rules after deletion.
- Keep task titles/note as plain strings; do not introduce HTML rendering or a `children` field.

**Step 4: Run the focused tests and verify they pass**

```bash
bun test src/lib/stores/quick-create-store.test.ts
```

Expected: PASS, including all pre-existing store tests.

**Step 5: Commit the store slice**

```bash
git add src/lib/stores/quick-create-store.ts src/lib/stores/quick-create-store.test.ts src/lib/domain/v1/completion.ts
git commit -m "feat(web): add structured quick-create task state"
```

Only include `completion.ts` if it was actually changed.

---

### Task 2: Add task wire-format regression coverage

**Files:**
- Modify: `tastile-web/src/lib/api/v1/plan-wire.test.ts`
- Modify: `tastile-web/src/lib/api/v1/plan-wire.ts` only if the current converter does not preserve the new task fields.

**Step 1: Write failing wire tests**

Add a representative completion payload containing two UUIDv7 tasks, one note, one completion condition, and one order rule. Assert that `toWireSetPlanBody` emits:

- `content.description` (not `content.note`);
- `complete` as the converted condition tree;
- `order[].target_task_id` and numeric `order[].relation`;
- `order[].when` as `null` when no conditional order is configured;
- no `children` field.

Also assert that empty-title filtering is applied at the submit/snapshot boundary, not by silently mutating the task editor state.

**Step 2: Run the focused test and verify failure if applicable**

```bash
bun test src/lib/api/v1/plan-wire.test.ts
```

Expected: the new assertions fail until the store snapshot/converter boundary is aligned.

**Step 3: Implement only required conversion/filtering**

Keep `StoreTaskDefinition.content.note` as the internal field and retain the existing `description` wire mapping. Ensure order ids, task ids, and condition references are normalized consistently with the existing UUID normalization code. Do not add a second serializer or alter unrelated plan sections.

**Step 4: Run wire and store tests**

```bash
bun test src/lib/api/v1/plan-wire.test.ts src/lib/stores/quick-create-store.test.ts
```

Expected: PASS.

**Step 5: Commit the wire contract**

```bash
git add src/lib/api/v1/plan-wire.ts src/lib/api/v1/plan-wire.test.ts
git commit -m "test(web): pin structured task wire payload"
```

---

### Task 3: Add staged task summaries and the task detail sub-panel

**Files:**
- Modify: `tastile-web/src/components/tiles/QuickTileCreate.tsx`
- Create: `tastile-web/src/components/tiles/quick-task-editor.test.tsx` (or the repository's established component-test location if one exists)

**Step 1: Write component tests for disclosure behavior**

Using Testing Library, cover:
- the task section renders as a collapsed summary row and expands inline;
- opening one task's edit affordance sets `editingTaskId` and `activePanel = "task"`;
- opening another task replaces the first detail view rather than stacking multiple detail editors;
- closing the existing sub-panel clears `editingTaskId`;
- task row badges expose note/completion/order presence without rendering note HTML.

Mock only the API submission boundary; use the real Zustand store for editor state.

**Step 2: Run the component tests and verify failure**

```bash
bun test src/components/tiles/quick-task-editor.test.tsx
```

Expected: FAIL because `StagedSection`, task summary rows, and the `task` panel do not exist.

**Step 3: Implement progressive disclosure without changing the shell**

- Add a local `StagedSection` presentational wrapper: title, digest chips, expanded state, and inline children.
- Rewrite the existing inline task item as `TaskRow`: title input, note/completion/order digest badges, and an edit `ActionIcon`.
- Add `TaskDetailPanel` under the existing sub-panel rendering path with key `task`. It must use the same fixed positioning, z-index, close handler, transition classes, and panel width as the existing panels.
- Add note editing via `Textarea`, completion editing using the existing `INTENT_ITEMS` / condition controls for the Phase-A subset, and order editing through a child row component.
- Store `editingTaskId` in the UI state/store as designed; do not keep task detail fields in local React state.
- Keep the existing composer head/body/foot dimensions and all existing sub-panel keys unchanged.
- Keep note output text-only and accessible labels in both locales where the component currently supports translations.

**Step 4: Run the component tests and verify they pass**

```bash
bun test src/components/tiles/quick-task-editor.test.tsx
```

Expected: PASS.

**Step 5: Run the existing QuickCreate-related unit suite**

```bash
bun test src/lib/stores/quick-create-store.test.ts src/lib/api/v1/plan-wire.test.ts
```

Expected: PASS.

**Step 6: Commit the disclosure UI**

```bash
git add src/components/tiles/QuickTileCreate.tsx src/components/tiles/quick-task-editor.test.tsx
 git commit -m "feat(web): add staged structured task editor"
```

---

### Task 4: Add order-rule editing and submit validation

**Files:**
- Modify: `tastile-web/src/components/tiles/QuickTileCreate.tsx`
- Modify: `tastile-web/src/lib/stores/quick-create-store.ts`
- Modify: `tastile-web/src/lib/stores/quick-create-store.test.ts`
- Modify: `tastile-web/src/components/tiles/quick-task-editor.test.tsx`

**Step 1: Write failing order and submit-gate tests**

Cover:
- `TaskOrderRuleRow` target options include sibling tasks but exclude the edited task itself;
- relation options serialize as numeric `0`/`1`, not labels or strings;
- adding/removing/changing a rule updates only the selected task by UUID;
- a cycle displays an inline validation alert and disables submit;
- deleting a target task removes its dangling rules and restores submit when no cycle remains.

**Step 2: Run focused tests and verify failure**

```bash
bun test src/components/tiles/quick-task-editor.test.tsx src/lib/stores/quick-create-store.test.ts
```

Expected: FAIL until order rows and the `canSubmit` task graph gate are implemented.

**Step 3: Implement the minimum order editor and validation**

- Add `TaskOrderRuleRow` with Mantine `Select` and `SegmentedControl`.
- Generate target options from current sibling tasks and filter out the edited task id.
- Generate each new order-rule id with UUIDv7 and use `TaskOrderRelation.BEFORE` / `AFTER` numeric constants.
- Add `taskOrderValid` to the existing `canSubmit` expression and existing footer disabled condition. Show a concise inline alert near the task section when invalid.
- Preserve existing `titleOk`, span, duration, and server-error gates.
- On submit, drop tasks whose trimmed title is empty; discard their notes/order rules with them. Do not write the filtered result back into the editor state unless the existing submit architecture requires a snapshot-only transformation.
- Treat an empty activity-time completion value as the existing manual-check default without adding a new error path.

**Step 4: Run focused tests and verify pass**

```bash
bun test src/components/tiles/quick-task-editor.test.tsx src/lib/stores/quick-create-store.test.ts
```

Expected: PASS.

**Step 5: Commit order and validation**

```bash
git add src/components/tiles/QuickTileCreate.tsx src/components/tiles/quick-task-editor.test.tsx src/lib/stores/quick-create-store.ts src/lib/stores/quick-create-store.test.ts
git commit -m "feat(web): validate quick-create task ordering"
```

---

### Task 5: Verify the complete UI and emitted command in a browser

**Files:**
- Modify: `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts` only if the existing browser harness is the correct place for a reusable regression; otherwise record the manual verification in the implementation result and do not add a brittle test.

**Step 1: Run static checks and all unit/component tests**

```bash
bun test
bun run typecheck
bun run lint
```

Expected: all commands exit 0. Fix only regressions introduced by this feature.

**Step 2: Start the development server**

```bash
bun dev
```

Use the existing local authentication/API setup documented by `tastile-web/CLAUDE.md`; do not fabricate credentials or endpoints.

**Step 3: Exercise the golden path with Chrome DevTools MCP**

Open QuickCreate in the real browser and verify:
1. the task section starts compact and expands on the same scrollable screen;
2. add two tasks and edit each through the existing slide-in sub-panel;
3. add a note to one task;
4. configure activity-time completion on one task;
5. add `Task A BEFORE Task B`, then inspect the target options to confirm self-exclusion;
6. submit and observe the emitted command/network payload contains `content.description`, `complete`, and `order` with numeric `relation`;
7. create a cycle and confirm the footer submit button is disabled and the inline validation is visible;
8. delete a task and confirm sibling references to it disappear.

Capture the observed request body or console/network evidence. Do not claim browser verification from component tests alone.

**Step 4: Run the final focused regression suite**

```bash
bun test src/lib/stores/quick-create-store.test.ts src/lib/api/v1/plan-wire.test.ts src/components/tiles/quick-task-editor.test.tsx
```

Expected: PASS.

**Step 5: Review the diff against scope**

```bash
git status --short
git diff --stat
```

Confirm only the planned web files changed; the existing sub-panel mechanism and core repository remain untouched. Do not commit unless explicitly requested.

---

## Acceptance Criteria

- Existing QuickTileCreate main/sub-panel shell and slide-in behavior are unchanged.
- Tasks support note, per-task completion condition, and numeric BEFORE/AFTER order rules.
- Task edits are UUID-resolved and do not rely on array indexes.
- Dangling order targets are removed on task deletion; cycles block submission.
- Empty-title tasks are omitted from the submitted completion payload.
- Wire payload uses `content.description`, `complete`, and `order[].relation` as required by tastile-core OpenAPI.
- No task-level `children`/hierarchy field is introduced.
- Store, wire, component, typecheck, lint, and browser verification are green before completion.
