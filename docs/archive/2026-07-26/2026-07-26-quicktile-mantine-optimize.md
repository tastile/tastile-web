# QuickTileCreate Mantine Optimization

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up QuickTileCreate.tsx styles and component structure by replacing ad-hoc Tailwind with Mantine components, extracting duplicated patterns, and reducing the file from 2780 lines to ~2200 lines.

**Architecture:** Incremental refactor — no new packages, no `@mantine/form`. Replace raw `<input>`, `<div>` wrappers, and inline Tailwind with Mantine primitives (`Paper`, `Group`, `Stack`, `Text`, `UnstyledButton`, `ActionIcon`). Extract duplicated sub-panel header into a shared component. Consolidate repeated `styles` objects into module-level constants.

**Tech Stack:** Mantine v9 (already installed), React, TypeScript, Tailwind CSS v4

---

## Scope

| Area | Change |
|---|---|
| Sub-panel header | Extract repeated 62px header bar into `SubPanelHeader` component |
| Essential rows | Replace `<Button>` as clickable card with `UnstyledButton` + `Group` |
| Condition card | Replace `<div>` + inline Tailwind with `Paper` + `Stack` |
| Task rows | Replace raw `<div>` wrappers with Mantine `Paper` / `Group` |
| Action buttons | Standardize footer buttons with Mantine `Group` + proper variants |
| Inline styles | Consolidate repeated `styles={{ ... }}` objects into module constants |
| Raw inputs | Replace `<input type="text">` with Mantine `TextInput` where inside panels |
| File size | Extract `ConditionEditor` + `TermFields` + helpers into `src/components/tiles/editor/ConditionEditor.tsx` |

**Out of scope:** `@mantine/form` migration (separate plan), SchedulePanel/AutomationPanel changes, behavior sub-panel Radio restructure.

---

## Task 1: Extract SubPanelHeader component

**Files:**
- Create: `src/components/tiles/editor/SubPanelHeader.tsx`
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Create SubPanelHeader**

The sub-panel header pattern is duplicated 7 times (intent, time, duration, recurring, references, completion, meta, behavior). Extract it.

```tsx
// src/components/tiles/editor/SubPanelHeader.tsx
"use client";

import { ActionIcon, Group, Stack } from "@mantine/core";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface SubPanelHeaderProps {
  onBack: () => void;
  backAriaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
}

export function SubPanelHeader({ onBack, backAriaLabel, title, subtitle }: SubPanelHeaderProps) {
  return (
    <Group
      h={62}
      gap="sm"
      px="sm"
      className="shrink-0 border-b border-border bg-surface-0"
    >
      <ActionIcon
        type="button"
        onClick={onBack}
        variant="subtle"
        size={34}
        radius="lg"
        aria-label={backAriaLabel}
      >
        <ChevronLeft size={16} />
      </ActionIcon>
      <Stack gap={0} className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold">{title}</strong>
        {subtitle ? (
          <small className="block truncate text-[10px] text-foreground-muted">{subtitle}</small>
        ) : null}
      </Stack>
    </Group>
  );
}
```

**Step 2: Replace all 7 sub-panel headers in QuickTileCreate.tsx**

Replace each duplicated header block like:
```tsx
<div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
  <ActionIcon ...><ChevronLeft ... /></ActionIcon>
  <div className="flex-1 min-w-0">...</div>
</div>
```

With:
```tsx
<SubPanelHeader
  onBack={() => setActivePanel("base")}
  backAriaLabel={t("tiles.back")}
  title={t("quickCreate.timeNavTitle")}
  subtitle={t("quickCreate.timeNavSub")}
/>
```

Apply to: intent, time, duration, recurring, references, completion, meta, behavior panels.

**Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/tiles/editor/SubPanelHeader.tsx src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): extract SubPanelHeader from QuickTileCreate sub-panels"
```

---

## Task 2: Consolidate SegmentedControl styles into shared constant

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`
- Modify: `src/components/tiles/editor/SchedulePanel.tsx`
- Modify: `src/components/tiles/editor/AutomationPanel.tsx`

**Step 1: Create shared styles constant**

The same `SEGMENT_STYLES` object is duplicated in 3 files. Create one canonical version.

```ts
// Add to src/components/tiles/editor/panel-styles.ts
export const SEGMENT_STYLES = {
  root: { backgroundColor: "var(--surface-2)" },
  indicator: { backgroundColor: "var(--surface-1)" },
  label: { color: "var(--foreground)" },
} as const;
```

**Step 2: Import from all 3 files**

Replace local `SEGMENT_STYLES` definitions with:
```ts
import { SEGMENT_STYLES } from "@/components/tiles/editor/panel-styles";
```

Remove the local `SEGMENT_STYLES` const from `SchedulePanel.tsx` and `AutomationPanel.tsx`.

In QuickTileCreate.tsx, the styles are inlined at completion-condition-tabs and references. Replace with the shared constant.

**Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/tiles/editor/panel-styles.ts src/components/tiles/QuickTileCreate.tsx src/components/tiles/editor/SchedulePanel.tsx src/components/tiles/editor/AutomationPanel.tsx
git commit -m "refactor(tiles): consolidate SEGMENT_STYLES into shared panel-styles"
```

---

## Task 3: Extract ConditionEditor and TermFields into separate file

**Files:**
- Create: `src/components/tiles/editor/ConditionEditor.tsx`
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Create the new file**

Move from QuickTileCreate.tsx (lines ~2236-2780) into a new file:
- `ConditionKindSegmented` component
- `TermKindSegmented` component
- `defaultTerm()` function
- `updateCalendar`, `updateMoment`, `updateRelation`, `updateTask`, `updateRequirement`, `updateLife`, `updateValue` functions
- `TermFields` component
- `ConditionEditor` component

```tsx
// src/components/tiles/editor/ConditionEditor.tsx
"use client";

import { useId } from "react";
import { Button, NumberInput, Select } from "@mantine/core";
import { GitBranch, ListChecks, Plus, Trash2 } from "lucide-react";
import type { ConditionNode, Term } from "@/lib/domain/v1/condition";
import { ConditionKind, HolidayKind, type ConditionKindValue } from "@/lib/domain/v1/constants";
import { RowSegmented } from "@/components/ui/form";
import { TimeInput } from "@mantine/dates";

// ... (move all the functions and components here)
// Export them:
export { ConditionEditor, defaultTerm, type TermFieldsProps };
```

**Step 2: Update QuickTileCreate.tsx imports**

```ts
import { ConditionEditor, defaultTerm } from "@/components/tiles/editor/ConditionEditor";
```

Remove the moved functions and components from QuickTileCreate.tsx.

**Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/tiles/editor/ConditionEditor.tsx src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): extract ConditionEditor/TermFields to separate module"
```

---

## Task 4: Replace raw inputs with Mantine TextInput in panels

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Replace title input**

Replace the raw `<input type="text">` title field (line ~612) with Mantine `TextInput`:

```tsx
<TextInput
  value={identity.title}
  onChange={(e) => {
    setField("identity.title", e.target.value);
    if (invalidField === "title") setInvalidField(null);
  }}
  placeholder={t("quickCreate.titlePlaceholder")}
  aria-label={t("quickCreate.titlePlaceholder")}
  aria-required="true"
  aria-invalid={invalidField === "title" ? "true" : "false"}
  aria-describedby={invalidField === "title" ? "quick-create-error" : undefined}
  variant="unstyled"
  size="xl"
  fw={700}
  styles={{
    input: {
      fontSize: "1.5rem",
      lineHeight: "2rem",
      fontWeight: 700,
      letterSpacing: "-0.025em",
      padding: 0,
      paddingBottom: "0.75rem",
    },
  }}
/>
```

**Step 2: Replace reference ID input (line ~1532)**

Replace the raw `<input type="text">` with `TextInput`:

```tsx
<TextInput
  aria-label={t("quickCreate.referenceIdPlaceholder")}
  placeholder={t("quickCreate.referenceIdPlaceholder")}
  value={ref.target.referenceId ?? ""}
  onChange={(e) => {
    const next = plan.references.slice();
    next[i] = {
      ...ref,
      target: { ...ref.target, referenceId: e.target.value || null },
    };
    setField("plan.references", next);
  }}
  size="sm"
  variant="filled"
  styles={{ input: { backgroundColor: "var(--surface-2)" } }}
/>
```

**Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): replace raw text inputs with Mantine TextInput"
```

---

## Task 5: Replace essential row clickable pattern with UnstyledButton

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx` (V4EssentialRow)

**Step 1: Refactor V4EssentialRow**

Replace the inner `<Button type="button" onClick={onClick} className="group grid min-w-0 grid-cols-..." ...>` with Mantine `UnstyledButton` + `Group`:

```tsx
import { UnstyledButton, Group, Text } from "@mantine/core";

// Inside V4EssentialRow, replace the inner Button:
<UnstyledButton
  onClick={onClick}
  aria-label={editAria ?? `${label} を編集`}
  className="group min-w-0 flex-1 cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary"
>
  <Group gap="sm" wrap="nowrap">
    <Text size="xs" fw={700} c="var(--foreground-muted)" w={66} className="select-none">
      {label}
    </Text>
    <Group gap="xs" wrap="nowrap" className="min-w-0 flex-1 flex-wrap">
      {chip}
    </Group>
  </Group>
</UnstyledButton>
```

**Step 2: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 3: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): use UnstyledButton in V4EssentialRow for click targets"
```

---

## Task 6: Replace condition card divs with Paper + Stack

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Replace the condition section containers**

Replace:
```tsx
<div className="rounded-lg bg-surface-1 px-2 py-1.5">
```
With:
```tsx
<Paper p="sm" radius="lg" bg="var(--surface-1)">
```

And:
```tsx
<div className="space-y-2">
```
With:
```tsx
<Stack gap="sm">
```

And:
```tsx
<div className="flex items-center gap-2 rounded bg-surface-0 px-2 py-1 text-[11px]">
```
With:
```tsx
<Group gap="xs" p="xs" radius="md" bg="var(--surface-0)">
  <Text size="xs">...</Text>
</Group>
```

Apply to the condition tree rendering (lines ~960-1090).

**Step 2: Replace task row containers**

Replace task row `<div>` with `Paper`:
```tsx
<Paper
  key={tk.id}
  data-testid="quick-create-task-row"
  p="sm"
  radius="lg"
  withBorder
  bg="var(--surface-0)"
>
  <Group gap="sm" wrap="nowrap" mih={38}>
    ...
  </Group>
</Paper>
```

**Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): replace condition/task divs with Mantine Paper/Group/Stack"
```

---

## Task 7: Clean up footer buttons

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Replace footer button row**

Replace:
```tsx
<div className="flex h-[62px] shrink-0 items-center justify-between border-t border-border bg-surface-0 px-4">
```
With:
```tsx
<Group h={62} justify="space-between" px="md" className="shrink-0 border-t border-border bg-surface-0">
```

Replace the draft save button with proper Mantine variant:
```tsx
<Button
  leftSection={<Save size={14} />}
  type="button"
  variant="default"
  size="sm"
>
  下書き保存
</Button>
```

Replace the submit button:
```tsx
<Button
  type="button"
  variant="filled"
  size="lg"
  data-testid="quick-create-submit"
  onClick={handleSubmit}
  loading={submitting}
  disabled={submitting || !canSubmit || !titleOk || !spanOrderValid || submitBlocked}
  leftSection={submitting ? undefined : <Check size={16} />}
>
  {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
</Button>
```

**Step 2: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 3: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): clean up footer buttons with Mantine Group/Button"
```

---

## Task 8: Replace behavior role radio cards with Mantine Radio

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Simplify the behavior role Radio.Group**

The current behavior sub-panel (lines ~2040-2110) uses `Radio.Group` with complex wrapper divs. Simplify:

```tsx
<Radio.Group
  value={String(plan.role)}
  onChange={(value) => setField("plan.role", Number(value) as PlanRoleValue)}
  data-testid="behavior-role"
>
  <Stack gap="sm">
    <Radio.Card
      value={String(PlanRole.EXECUTABLE)}
      p="md"
      radius="xl"
      withBorder
      className="transition-colors hover:var(--surface-1) [&[data-checked]]:border-primary [&[data-checked]]:bg-accent-soft"
    >
      <Group gap="sm" wrap="nowrap">
        <Radio.Indicator />
        <div>
          <Group gap="xs">
            <Play size={14} className="text-foreground-muted" />
            <Text size="sm" fw={600}>{t("quickCreate.behaviorExecutable")}</Text>
          </Group>
          <Text size="xs" c="var(--foreground-muted)">{t("quickCreate.behaviorExecutableSub")}</Text>
        </div>
      </Group>
    </Radio.Card>

    <Radio.Card
      value={String(PlanRole.LABEL)}
      p="md"
      radius="xl"
      withBorder
      className="transition-colors hover:var(--surface-1) [&[data-checked]]:border-primary [&[data-checked]]:bg-accent-soft"
    >
      <Group gap="sm" wrap="nowrap">
        <Radio.Indicator />
        <div>
          <Group gap="xs">
            <Tag size={14} className="text-foreground-muted" />
            <Text size="sm" fw={600}>{t("quickCreate.behaviorLabel")}</Text>
          </Group>
          <Text size="xs" c="var(--foreground-muted)">{t("quickCreate.behaviorLabelSub")}</Text>
        </div>
      </Group>
    </Radio.Card>
  </Stack>
</Radio.Group>
```

**Step 2: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 3: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): simplify behavior role radio cards with Mantine Radio.Card"
```

---

## Task 9: Replace intent sub-panel cards with Mantine SimpleGrid + Paper

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Replace the intent grid**

The intent sub-panel (lines ~1171-1276) renders a 2-col grid of `<Button>` cards. Replace with `SimpleGrid` + `Paper` + `UnstyledButton`:

```tsx
import { SimpleGrid, Paper, UnstyledButton, Stack, Text } from "@mantine/core";

<SimpleGrid cols={2} spacing="sm">
  {intentItems.map((item) => (
    <Paper key={item.key} withBorder radius="lg" p="md">
      <UnstyledButton
        onClick={() => setActivePanel(item.panel)}
        className="flex min-h-[91px] w-full flex-col items-start text-left focus-visible:ring-2 focus-visible:ring-primary"
      >
        <item.icon size={16} className="mb-1.5 text-primary" />
        <Text size="xs" fw={600} mb={2}>{item.title}</Text>
        <Text size="10" c="var(--foreground-muted)">{item.sub}</Text>
      </UnstyledButton>
    </Paper>
  ))}
</SimpleGrid>
```

Extract the intent items into a data array to eliminate the repetitive JSX.

**Step 2: Verify**

Run: `bun run typecheck && bun run lint`
Expected: clean

**Step 3: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): simplify intent sub-panel with SimpleGrid + data-driven cards"
```

---

## Task 10: Final cleanup — remove dead imports and verify

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Remove unused imports**

After all extractions, run:
```bash
bunx tsc --noEmit
```

Check for any unused imports and remove them (e.g., if `GitBranch`, `Link2` etc. were only used by the now-extracted ConditionEditor).

**Step 2: Run full verification**

```bash
bun run typecheck && bun run lint && bun test
```
Expected: all pass

**Step 3: Count lines**

```bash
wc -l src/components/tiles/QuickTileCreate.tsx
```
Expected: ~2200 lines (down from 2780)

**Step 4: Commit**

```bash
git add src/components/tiles/QuickTileCreate.tsx
git commit -m "refactor(tiles): final cleanup after Mantine optimization"
```

---

## Verification Checklist

After all tasks:
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes
- [ ] QuickTileCreate opens at `/dashboard/tasks`
- [ ] All sub-panels slide correctly
- [ ] Title input works
- [ ] Essential rows (time, duration, repeat) open correct sub-panels
- [ ] Condition tree renders and add/remove works
- [ ] Task rows render with menu
- [ ] Behavior role selection works
- [ ] Submit creates a tile
- [ ] Mobile layout still functions (bottom sheet)
