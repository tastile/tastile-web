# QuickTileCreate redesign: row-based form layout

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

## Context

The previous refactor (2026-06-22) added semantic spacing tokens and tightened primitive radius, but left QuickTileCreate with the same **ad-hoc per-element spacing** problem it was trying to fix. The user reports:

- The panel is "abnormally contracted" — rows are 28-40px tall, varying.
- Icons are 14-16px, inconsistent.
- Spacing inside the panel is too tight (16px) and makes everything feel cramped.
- Per-element fixes won't work — the layout must be driven by **strict container rules**.

The user picked **Material / Apple HIG** as the design reference (8-12px radius, sufficient row height, shadows for hierarchy), confirmed **24px panel padding / 48px row height**, and confirmed **no text labels** — icons + placeholders explain each row.

## Goal

Rewrite QuickTileCreate so that:

1. Every row is **48px tall, exactly** — enforced by a `FormRow` container, not by per-element classes.
2. Every panel has **24px internal padding** — enforced by a `FormPanel` container.
3. Every row has a **20px icon** at the left, leading-aligned.
4. **No text labels** anywhere — placeholder text (for inputs) or current-value text (for sub-panel rows) serves as the explanation.
5. Sub-panel rows show **icon + name + current value + chevron**.
6. Submit is a **standard button** (40px tall, 8px radius), not a giant full-width pill.

## Token system (additions to `globals.css`)

```css
@theme inline {
  /* ... existing tokens ... */

  /* Row-based form layout — 2026-06-24 */
  --spacing-panel: 1.5rem;       /* 24px — panel internal padding */
  --spacing-row: 3rem;           /* 48px — row min-height (Material standard) */
  --spacing-row-tight: 2.75rem;  /* 44px — for rows that contain their own segmented control */
}
```

These generate Tailwind utilities: `p-panel`, `gap-panel`, `min-h-row`, `min-h-row-tight`, etc.

## Container components (new, `src/components/ui/form/`)

### `FormPanel`

Wraps the form. Sets internal padding to 24px, gap between rows to 8px.

```tsx
<FormPanel>{children}</FormPanel>
// renders: <div className="p-panel flex flex-col gap-2">{children}</div>
```

### `FormRow`

The 48px-row primitive. 3-column grid: `[icon 20px] [content 1fr] [trailing auto]`. Min-height 48px. Items vertically centered. Hover state for input rows.

```tsx
<FormRow icon={<Clock size={20} />} trailing={<TimePickerButton />}>
  <input className="bg-transparent w-full" placeholder="00:25" />
</FormRow>
// renders: <div data-slot="form-row" className="grid grid-cols-[20px_1fr_auto] items-center gap-3 min-h-row">
//             <div className="flex items-center justify-center text-foreground-muted">{icon}</div>
//             <div className="min-w-0 flex items-center">{children}</div>
//             <div className="flex items-center justify-end">{trailing}</div>
//           </div>
```

### `FormDivider`

Section separator. 16px vertical margin, 1px line.

```tsx
<FormDivider />
// renders: <hr className="my-4 border-border" />
```

## Row primitive components (new, `src/components/ui/form/`)

Each wraps `FormRow` and provides the trailing/content specifics for one row kind.

### `RowInput` — icon + placeholder input

```tsx
<RowInput icon={Clock} placeholder="00:25" value={duration} onChange={...} trailing={...} />
```

### `RowSegmented` — icon + segmented control

```tsx
<RowSegmented icon={CheckCircle2}
  options={[{ value: "manual", label: "Manual" }, ...]}
  value={doneRule}
  onChange={...}
/>
```

### `RowToggle` — icon + label placeholder + switch

```tsx
<RowToggle icon={BookOpen} placeholder="Period label" checked={...} onChange={...} />
```

### `RowSubPanel` — icon + name + current value + chevron

```tsx
<RowSubPanel icon={Repeat} name="Recurrence" value="Off" onClick={...} />
```

## File changes

| Path | Change |
|---|---|
| `src/app/globals.css` | Add 3 spacing tokens |
| `src/components/ui/form/FormPanel.tsx` | New |
| `src/components/ui/form/FormRow.tsx` | New |
| `src/components/ui/form/FormDivider.tsx` | New |
| `src/components/ui/form/RowInput.tsx` | New |
| `src/components/ui/form/RowSegmented.tsx` | New |
| `src/components/ui/form/RowToggle.tsx` | New |
| `src/components/ui/form/RowSubPanel.tsx` | New |
| `src/components/ui/form/index.ts` | New — barrel export |
| `src/components/tiles/QuickTileCreate.tsx` | Full rewrite using containers |
| `src/components/tiles/QuickTileCreate.test.tsx` | Update tests if role-based queries changed (likely no change — still uses getByRole) |

## Concrete QuickTileCreate layout

```tsx
<FormPanel>
  {/* Header is owned by the SidePanel primitive, not FormPanel */}

  <FormDivider /> {/* top-of-form divider if needed */}

  <RowInput icon={Clock} placeholder="00:25" value={duration} onChange={setDuration} />
  <RowSegmented icon={CheckCircle2} options={DONE_RULE_OPTIONS} value={doneRule} onChange={setDoneRule} />
  <RowInput icon={Calendar} placeholder="When?" value={schedule} onChange={setSchedule} />
  <RowToggle icon={BookOpen} placeholder="Period label" checked={isLabel} onChange={setIsLabel} />
  <RowInput icon={FolderOpen} placeholder="Project" value={project} onChange={setProject} />
  <RowInput icon={Tag} placeholder="Tag" value={tag} onChange={setTag} />
  <RowInput icon={FileText} placeholder="Add a note" value={note} onChange={setNote} />

  <FormDivider />

  <RowSubPanel icon={Repeat} name="Recurrence" value={recurrenceLabel} onClick={openRecurrence} />
  <RowSubPanel icon={Ban} name="Interrupts" value={interruptLabel} onClick={openInterrupt} />
  <RowSubPanel icon={Zap} name="Automation" value={automationLabel} onClick={openAutomation} />
  <RowSubPanel icon={Clock4} name="Timed labels" value={timedLabelsLabel} onClick={openTimedLabels} />
</FormPanel>
```

## Visual specs

| Element | Spec |
|---|---|
| Panel internal padding | 24px (`p-panel`) |
| Inter-row gap | 8px (form-specific, NOT `gap-section` 16px — too sparse for 12 rows) |
| Row min-height | 48px (`min-h-row`) |
| Row layout | grid `20px 1fr auto`, items-center, gap-3 (12px between icon/content/trailing) |
| Icon | 20px, fixed (lucide `size={20}`) |
| Input row hover | `bg-surface-2` (full row background) |
| Input text | `text-sm` (14px) |
| Placeholder text | `text-foreground-muted` |
| Sub-panel row value | `text-foreground-muted`, `text-sm` |
| Chevron | 16px, `text-foreground-muted` |
| Segmented control | full row width, 8px radius, active segment has `bg-surface-1 shadow-sm` |
| Toggle switch | 36×20px, 18px thumb |
| Divider | 1px `bg-border`, 16px vertical margin |
| Submit button | `rounded-md` (8px), 40px height, full panel width minus 24px padding each side |

## Radius (locked)

- Panel: `rounded-lg` (10-12px, matches Material)
- Form rows / inputs: transparent (no border-radius on the row itself)
- Segmented control: `rounded-md` (8px)
- Submit button: `rounded-md` (8px)
- Toggle switch: `rounded-full` (it's a switch — full radius is correct)

## Implementation order

1. Add tokens to `globals.css` — Task 54
2. Create containers (`FormPanel`, `FormRow`, `FormDivider`) — Task 55
3. Create row primitives (`RowInput`, `RowSegmented`, `RowToggle`, `RowSubPanel`) — Task 56
4. Rewrite QuickTileCreate base panel — Task 57
5. Rewrite 4 sub-panels (using same containers) — Task 58
6. Verify — Task 59

## Verification

- `bun run test:unit` — 201+/201+ passing
- `bun run typecheck` — clean
- `bun run lint` — clean
- Browser visual: open QuickTileCreate, confirm:
  - All rows are visually identical in height (48px)
  - Panel has 24px internal padding
  - No text labels visible (only icons + placeholders + values)
  - Sub-panel rows show current value + chevron
  - Submit is a standard button, not a pill
- Take a screenshot for review

## Out of scope (follow-up tasks)

- Add ESLint rule to reject `py-1.5`, `px-3`, `gap-1.5` etc. in form files
- Migrate calendar, panels, shell, marketing to use these containers
- Promote the form components to a `@tastile/ui-form` package
- Add visual regression tests (Playwright) for the form layout
