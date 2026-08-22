# QuickCreate Structured-Task Workflow — Design

> Date: 2026-07-27
> Target: `tastile-web` — `src/components/tiles/QuickTileCreate.tsx` + `src/lib/stores/quick-create-store.ts`
> Domain source of truth: `tastile-core/v1/13-completion.md`, core `TaskDefinitionSchema` (openapi.rs:418)

## Goal

Optimize the QuickCreate workflow so a task can be expressed *structurally* — note, per-task
completion condition, and order/dependency — without changing the existing sub-panel expansion
mechanism. Progressive disclosure on one scrollable screen; row → slide-in sub-panel for detail.

## Domain constraint (verified)

`TaskDefinition` = `{ id, content:{title, description}, show, complete, order: TaskOrderRule[] }`.
Confirmed at three levels: v1/13 spec, core domain struct `TaskDefinition`, and OpenAPI
`TaskDefinitionSchema`. **There is no `children` field** — task-level nesting/hierarchy is not a
v1 concept (the `NestingRuleSchema` that exists is `Plan.planning.nesting_rules`, whole-tile
placement nesting, a Phase B concern). **Nesting/hierarchy is deferred.** The other three
enhancements map natively:

| Enhancement | v1 field |
| --- | --- |
| Task note | `content.description` (nullable) |
| Per-task completion | `complete: Condition` |
| Order / dependency | `order: TaskOrderRule[]` (`{id, targetTaskId, relation: 0 BEFORE \| 1 AFTER, when}`) |

## Architecture

- Keep composer shell (head 68px + body + foot 62px), `panelClass` / `subPanelClass` (z-56 main,
  z-57 sub), Zustand slices, `submitCreateTile`. **No store schema rewrite.**
- Body sections become collapsible summary rows (progressive disclosure); one detail editor open
  at a time via the existing sub-panel slide.
- New sub-panel key `task` edits one `TaskDefinition` by id. Task detail state lives in the store
  tasks array via dotted-path `setField` — never local component state.

## Components

- **`StagedSection`** (new wrapper): title + chip digest when collapsed, children inline when
  expanded. Cosmetic, no store coupling.
- **`TaskRow`** (rewrite of inline task item): title input + digest badges (📝 note / ✓ completion
  / ↕ order) + edit affordance opening the `task` sub-panel.
- **`TaskDetailPanel`** (new sub-panel, key `task`): Note (`content.description`), Completion
  (`complete`, Phase-A subset: manual-check + activity-time, reusing `INTENT_ITEMS`), Order (list
  of `TaskOrderRuleRow`).
- **`TaskOrderRuleRow`** (new): target `Select` (sibling tasks, self excluded) + `SegmentedControl`
  BEFORE/AFTER.
- Mantine primitives only: `ActionIcon`, `Textarea`, `Select`, `SegmentedControl`, `Button`,
  `Badge` — all already in deps.

## Data flow

All writes through dotted-path `setField`, id-resolved (not array index — v1/13 §261):

- `completion.tasks.<id>.content.title`
- `completion.tasks.<id>.content.description` (`string | null`)
- `completion.tasks.<id>.complete` (Condition node)
- `completion.tasks.<id>.order` (`TaskOrderRule[]`)

New task push: `{ id: uuidv7(), content:{title:"", description:null}, show:null,
complete:<default manual-check>, order:[] }`. Sub-panel open sets `editingTaskId` + `activePanel="task"`;
close clears `editingTaskId`. Delete task strips dangling `order` rules in siblings. Submit path
unchanged — Completion already serializes all fields; OpenAPI accepts them.

## Error handling

- **Cycle detection**: topological check over `tasks[].order`; a cycle sets `taskOrderValid=false`,
  inline alert, folds into `canSubmit = titleOk && spanOrderValid && durationValid && taskOrderValid
  && !submitBlocked`. Reason: v1/13 "Task 順序は循環禁止".
- **Dangling targets**: silent strip on delete.
- **Empty-title task**: dropped on submit (note/order discarded with it).
- **Completion subset**: activity-time 0/empty → fall back to manual-check default, no error.
- Notes are free text, rendered as text never HTML.
- Server errors: unchanged `submitCreateTile` → `ApiErrorKind` → foot alert. Server cycle catch
  (`BLOCKED`/`VALIDATION`) is a backstop.

## Testing

Unit (Vitest): id-aware setField; add task shape; delete cleanup; cycle detection; empty-title
drop; `canSubmit` gate. Component (Testing Library): StagedSection collapse/expand + single-panel;
TaskRow→panel `editingTaskId`; order rule row self-exclusion + numeric relation. Browser
(chrome-devtools MCP): create a tile with two ordered tasks + note + activity-time completion,
submit, observe the emitted command carries `content.description` / `complete` / `order` with
numeric `relation`.

## Out of scope

- Task nesting/hierarchy (no v1 `children`; deferred to a future task-model phase).
- Server-side AT changes (none — `TaskDefinitionSchema` already accepts these fields).
