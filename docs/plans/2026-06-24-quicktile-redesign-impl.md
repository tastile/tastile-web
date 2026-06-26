# QuickTileCreate Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace QuickTileCreate's ad-hoc spacing with strict container-driven layout: 24px panel padding, 48px rows, 20px icons, no text labels.

**Architecture:** New form layout components (`FormPanel`, `FormRow`, `FormDivider`) enforce vertical rhythm and 3-column row structure. New row primitives (`RowInput`, `RowSegmented`, `RowToggle`, `RowSubPanel`) compose the icon + content + trailing pattern. QuickTileCreate is rewritten as a flat list of these primitives — no text labels, no per-element spacing decisions.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Radix UI primitives (for Switch) + lucide-react icons.

---

## Task 54: Add panel/row spacing tokens

**Files:**
- Modify: `src/app/globals.css:159` (add 3 new tokens after `--spacing-page`)

**Step 1: Add new tokens to `globals.css`**

Open `src/app/globals.css` and after line 159 (`--spacing-page: 2rem;`) add:

```css
  /* Row-based form layout — 2026-06-24.
     panel (24px) — form panel internal padding
     row   (48px) — row min-height (Material HIG standard)
     row-tight (44px) — rows that contain a segmented control or compact input
  */
  --spacing-panel: 1.5rem;
  --spacing-row: 3rem;
  --spacing-row-tight: 2.75rem;
```

Update the comment block above `--spacing-control-compact` to also mention these new tokens.

**Step 2: Verify dev server still loads**

```bash
cd tastile-web && bun run dev
```

Open http://localhost:3000/dashboard/calendar in a browser. Confirm the page renders without Tailwind compile errors (check terminal output). Stop the dev server (Ctrl+C).

**Step 3: Commit**

```bash
cd tastile-web && git add src/app/globals.css && git commit -m "feat(design-tokens): add panel/row spacing tokens for form layout"
```

---

## Task 55: FormPanel + FormRow + FormDivider containers

**Files:**
- Create: `src/components/ui/form/FormPanel.tsx`
- Create: `src/components/ui/form/FormRow.tsx`
- Create: `src/components/ui/form/FormDivider.tsx`
- Create: `src/components/ui/form/FormPanel.test.tsx`
- Create: `src/components/ui/form/FormRow.test.tsx`
- Create: `src/components/ui/form/FormDivider.test.tsx`
- Create: `src/components/ui/form/index.ts`

**Step 1: Write failing test for `FormPanel`**

Create `src/components/ui/form/FormPanel.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormPanel } from "./FormPanel";

describe("FormPanel", () => {
  it("renders children inside a padded container", () => {
    render(
      <FormPanel>
        <span>row</span>
      </FormPanel>
    );
    const root = screen.getByText("row").parentElement;
    expect(root).toHaveClass("p-panel");
  });

  it("applies a flex column layout with 8px gap between children", () => {
    render(
      <FormPanel>
        <span>one</span>
        <span>two</span>
      </FormPanel>
    );
    const root = screen.getByText("one").parentElement;
    expect(root).toHaveClass("flex");
    expect(root).toHaveClass("flex-col");
    expect(root).toHaveClass("gap-2");
  });

  it("merges custom className", () => {
    render(
      <FormPanel className="extra-class">
        <span>x</span>
      </FormPanel>
    );
    const root = screen.getByText("x").parentElement;
    expect(root).toHaveClass("extra-class");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd tastile-web && bun run test:unit -- FormPanel
```

Expected: FAIL with "Cannot find module './FormPanel'" or similar.

**Step 3: Implement `FormPanel`**

Create `src/components/ui/form/FormPanel.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FormPanelProps {
  children: ReactNode;
  className?: string;
}

export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <div className={cn("p-panel flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd tastile-web && bun run test:unit -- FormPanel
```

Expected: 3 tests passing.

**Step 5: Write failing test for `FormRow`**

Create `src/components/ui/form/FormRow.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormRow } from "./FormRow";

describe("FormRow", () => {
  it("renders a 3-column grid with 48px min height", () => {
    render(
      <FormRow icon={<span data-testid="icon" />} trailing={<span data-testid="trailing" />}>
        <span data-testid="content">content</span>
      </FormRow>
    );
    const grid = screen.getByTestId("icon").parentElement;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-[20px_1fr_auto]");
    expect(grid).toHaveClass("items-center");
    expect(grid).toHaveClass("min-h-row");
  });

  it("places icon in first column", () => {
    render(
      <FormRow icon={<span data-testid="icon">⏱</span>}>
        <span>content</span>
      </FormRow>
    );
    const icon = screen.getByTestId("icon");
    expect(icon.parentElement).toHaveClass("grid-cols-[20px_1fr_auto]");
  });
});
```

**Step 6: Run test to verify it fails**

```bash
cd tastile-web && bun run test:unit -- FormRow
```

Expected: FAIL.

**Step 7: Implement `FormRow`**

Create `src/components/ui/form/FormRow.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FormRowProps {
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  tight?: boolean;
}

export function FormRow({ icon, children, trailing, className, tight = false }: FormRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[20px_1fr_auto] items-center gap-3",
        tight ? "min-h-row-tight" : "min-h-row",
        className,
      )}
    >
      <div className="flex items-center justify-center text-foreground-muted">{icon}</div>
      <div className="min-w-0 flex items-center">{children}</div>
      {trailing !== undefined && <div className="flex items-center justify-end">{trailing}</div>}
    </div>
  );
}
```

**Step 8: Run test to verify it passes**

```bash
cd tastile-web && bun run test:unit -- FormRow
```

Expected: 2 tests passing.

**Step 9: Write failing test for `FormDivider`**

Create `src/components/ui/form/FormDivider.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormDivider } from "./FormDivider";

describe("FormDivider", () => {
  it("renders a horizontal rule with 16px vertical margin and a border", () => {
    const { container } = render(<FormDivider />);
    const hr = container.querySelector("hr");
    expect(hr).toBeInTheDocument();
    expect(hr).toHaveClass("my-4");
    expect(hr).toHaveClass("border-border");
  });
});
```

**Step 10: Run test to verify it fails**

```bash
cd tastile-web && bun run test:unit -- FormDivider
```

Expected: FAIL.

**Step 11: Implement `FormDivider`**

Create `src/components/ui/form/FormDivider.tsx`:

```tsx
export function FormDivider() {
  return <hr className="my-4 border-border" />;
}
```

**Step 12: Run test to verify it passes**

```bash
cd tastile-web && bun run test:unit -- FormDivider
```

Expected: 1 test passing.

**Step 13: Create barrel export**

Create `src/components/ui/form/index.ts`:

```ts
export { FormPanel } from "./FormPanel";
export { FormRow } from "./FormRow";
export { FormDivider } from "./FormDivider";
```

**Step 14: Run full test suite to confirm no regression**

```bash
cd tastile-web && bun run test:unit
```

Expected: 201+ tests passing (existing + 6 new).

**Step 15: Commit**

```bash
cd tastile-web && git add src/components/ui/form/ && git commit -m "feat(ui): add FormPanel, FormRow, FormDivider containers"
```

---

## Task 56: RowInput, RowSegmented, RowToggle, RowSubPanel primitives

**Files:**
- Create: `src/components/ui/form/RowInput.tsx`
- Create: `src/components/ui/form/RowSegmented.tsx`
- Create: `src/components/ui/form/RowToggle.tsx`
- Create: `src/components/ui/form/RowSubPanel.tsx`
- Create: `src/components/ui/form/RowInput.test.tsx`
- Create: `src/components/ui/form/RowSegmented.test.tsx`
- Create: `src/components/ui/form/RowToggle.test.tsx`
- Create: `src/components/ui/form/RowSubPanel.test.tsx`
- Modify: `src/components/ui/form/index.ts` (add 4 new exports)

### Step 1-3: RowInput

**Test** (`RowInput.test.tsx`):

```tsx
/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { RowInput } from "./RowInput";

describe("RowInput", () => {
  it("renders a 48px row with a 20px icon and an input", () => {
    render(<RowInput icon={Clock} placeholder="00:25" />);
    const input = screen.getByPlaceholderText("00:25");
    expect(input).toBeInTheDocument();
    const grid = input.closest(".grid");
    expect(grid).toHaveClass("min-h-row");
    const svg = grid?.querySelector("svg");
    expect(svg).toHaveAttribute("width", "20");
  });

  it("forwards value and onChange", () => {
    render(<RowInput icon={Clock} placeholder="x" value="abc" onChange={() => {}} />);
    const input = screen.getByDisplayValue("abc");
    expect(input).toBeInTheDocument();
  });
});
```

Run test: `bun run test:unit -- RowInput` — expect FAIL.

**Implementation** (`RowInput.tsx`):

```tsx
import type { LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowInputProps {
  icon: LucideIcon;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: "text" | "time" | "date" | "datetime-local";
  trailing?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function RowInput({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
  trailing,
  className,
  ariaLabel,
}: RowInputProps) {
  return (
    <FormRow icon={<Icon size={20} />} trailing={trailing} className={className}>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
      />
    </FormRow>
  );
}
```

Run test: `bun run test:unit -- RowInput` — expect PASS.

### Step 4-6: RowSegmented

**Test** (`RowSegmented.test.tsx`):

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowSegmented } from "./RowSegmented";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("RowSegmented", () => {
  it("renders one button per option", () => {
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B" })).toBeInTheDocument();
  });

  it("marks the active option as checked", () => {
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="b" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange when an option is clicked", () => {
    const onChange = vi.fn();
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```

Run test: `bun run test:unit -- RowSegmented` — expect FAIL.

**Implementation** (`RowSegmented.tsx`):

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormRow } from "./FormRow";

interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

interface RowSegmentedProps<V extends string> {
  icon: LucideIcon;
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}

export function RowSegmented<V extends string>({
  icon: Icon,
  options,
  value,
  onChange,
  className,
}: RowSegmentedProps<V>) {
  return (
    <FormRow icon={<Icon size={20} />} tight className={className}>
      <div
        role="radiogroup"
        className="flex w-full rounded-md bg-surface-2 p-0.5"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </FormRow>
  );
}
```

Run test: `bun run test:unit -- RowSegmented` — expect PASS.

### Step 7-9: RowToggle

**Test** (`RowToggle.test.tsx`):

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowToggle } from "./RowToggle";

describe("RowToggle", () => {
  it("renders a toggle switch with aria-checked reflecting state", () => {
    render(<RowToggle icon={BookOpen} placeholder="Period label" checked onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click", () => {
    const onChange = vi.fn();
    render(<RowToggle icon={BookOpen} placeholder="Period label" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

Run test: `bun run test:unit -- RowToggle` — expect FAIL.

**Implementation** (`RowToggle.tsx`):

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowToggleProps {
  icon: LucideIcon;
  placeholder: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function RowToggle({ icon: Icon, placeholder, checked, onChange, className }: RowToggleProps) {
  return (
    <FormRow icon={<Icon size={20} />} className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={placeholder}
        onClick={() => onChange(!checked)}
        className="flex w-full items-center text-left text-sm text-foreground-muted focus:outline-hidden"
      >
        {placeholder}
      </button>
      <div
        className={
          "relative h-5 w-9 rounded-full transition-colors " +
          (checked ? "bg-primary" : "bg-surface-3")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-surface-1 shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </div>
    </FormRow>
  );
}
```

Run test: `bun run test:unit -- RowToggle` — expect PASS.

### Step 10-12: RowSubPanel

**Test** (`RowSubPanel.test.tsx`):

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { Repeat } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowSubPanel } from "./RowSubPanel";

describe("RowSubPanel", () => {
  it("renders a 48px row with icon, name, current value, and chevron", () => {
    render(<RowSubPanel icon={Repeat} name="Recurrence" value="Off" onClick={() => {}} />);
    expect(screen.getByText("Recurrence")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /recurrence/i });
    expect(button.closest(".grid")).toHaveClass("min-h-row");
  });

  it("calls onClick when the row is pressed", () => {
    const onClick = vi.fn();
    render(<RowSubPanel icon={Repeat} name="Recurrence" value="Off" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /recurrence/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

Run test: `bun run test:unit -- RowSubPanel` — expect FAIL.

**Implementation** (`RowSubPanel.tsx`):

```tsx
"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowSubPanelProps {
  icon: LucideIcon;
  name: string;
  value: string;
  onClick: () => void;
  className?: string;
}

export function RowSubPanel({ icon: Icon, name, value, onClick, className }: RowSubPanelProps) {
  return (
    <FormRow
      icon={<Icon size={20} />}
      trailing={<ChevronRight size={16} className="text-foreground-muted" />}
      className={className}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={name}
        className="flex w-full items-center justify-between gap-3 text-left focus:outline-hidden"
      >
        <span className="text-sm text-foreground">{name}</span>
        <span className="text-sm text-foreground-muted">{value}</span>
      </button>
    </FormRow>
  );
}
```

Run test: `bun run test:unit -- RowSubPanel` — expect PASS.

### Step 13: Update barrel export

Edit `src/components/ui/form/index.ts`:

```ts
export { FormDivider } from "./FormDivider";
export { FormPanel } from "./FormPanel";
export { FormRow } from "./FormRow";
export { RowInput } from "./RowInput";
export { RowSegmented } from "./RowSegmented";
export { RowSubPanel } from "./RowSubPanel";
export { RowToggle } from "./RowToggle";
```

### Step 14: Run full test suite

```bash
cd tastile-web && bun run test:unit
```

Expected: 201+ tests passing.

### Step 15: Commit

```bash
cd tastile-web && git add src/components/ui/form/ && git commit -m "feat(ui): add RowInput, RowSegmented, RowToggle, RowSubPanel primitives"
```

---

## Task 57: Rewrite QuickTileCreate base panel

**Files:**
- Rewrite: `src/components/tiles/QuickTileCreate.tsx`
- Modify (likely no-op): `src/components/tiles/QuickTileCreate.test.tsx` (existing tests should pass; if any need updating because of role changes, update minimally)

This task is the largest. The current 1922-line file is replaced with a thin composition of the new containers + row primitives.

**Step 1: Read current QuickTileCreate to map behavior preservation**

```bash
cd tastile-web && wc -l src/components/tiles/QuickTileCreate.tsx
```

Skim the file in 200-line chunks to identify: state shape, action handlers, sub-panel routing logic. **Do not modify yet.**

**Step 2: Write the new QuickTileCreate.tsx (skeleton with state + actions)**

The new file should be ~400 lines. It will:
- Keep the same Zustand store wiring (`useQuickCreateStore`)
- Keep the same execution engine context wiring
- Keep the same i18n hook
- Keep the same `onSubmit` logic
- Use the new containers/primitives for layout
- Eliminate all text labels

**Structure** (top-level):

```tsx
"use client";

import { Ban, BookOpen, Calendar, Clock, FileText, FolderOpen, Repeat, Tag, Type, Zap, Clock4 } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDivider, FormPanel, RowInput, RowSegmented, RowSubPanel, RowToggle } from "@/components/ui/form";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { getSessionClient } from "@/lib/daemon/id-token-client";
import { buildQuickCreateCommand } from "./build-command";
// (build-command.ts is a NEW small helper extracted from the old file)

type DoneRule = "manual" | "target" | "fixedEnd";

const DONE_RULE_OPTIONS: Array<{ value: DoneRule; label: string }> = [
  { value: "manual", label: "" }, // labels come from t()
  { value: "target", label: "" },
  { value: "fixedEnd", label: "" },
];

export function QuickTileCreate() {
  const { t, locale } = useTranslation();
  const { execute, state, loading } = useExecutionEngineContext();
  const { isOpen, close } = useQuickCreateStore();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("00:25");
  const [doneRule, setDoneRule] = useState<DoneRule>("manual");
  const [isLabel, setIsLabel] = useState(false);
  const [project, setProject] = useState("");
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [subPanel, setSubPanel] = useState<"recurrence" | "interrupt" | "automation" | "timed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ...sub-panel state preserved from old file...

  // ...submit logic, error display, sub-panel rendering...

  return (
    <>
      <SidePanel
        visible={isOpen}
        onCancel={close}
        onConfirm={onSubmit}
        confirmText={t("quickCreate.create")}
        cancelText={t("quickCreate.cancel")}
        header={<TitleHeader value={title} onChange={setTitle} />}
        hideFooter
      >
        <FormPanel>
          <RowInput icon={Clock} placeholder="00:25" value={duration} onChange={setDuration} />
          <RowSegmented
            icon={CheckCircle2}
            options={DONE_RULE_OPTIONS}
            value={doneRule}
            onChange={setDoneRule}
          />
          <RowInput icon={Calendar} placeholder={t("quickCreate.schedulePlaceholder")} value={schedule} onChange={setSchedule} />
          <RowToggle
            icon={BookOpen}
            placeholder={t("quickCreate.periodLabel")}
            checked={isLabel}
            onChange={setIsLabel}
          />
          <RowInput icon={FolderOpen} placeholder={t("quickCreate.projectPlaceholder")} value={project} onChange={setProject} />
          <RowInput icon={Tag} placeholder={t("quickCreate.tagPlaceholder")} value={tag} onChange={setTag} />
          <RowInput icon={FileText} placeholder={t("quickCreate.notePlaceholder")} value={note} onChange={setNote} />
          <FormDivider />
          <RowSubPanel icon={Repeat} name={t("quickCreate.recurrence")} value={recurrenceLabel} onClick={() => setSubPanel("recurrence")} />
          <RowSubPanel icon={Ban} name={t("quickCreate.interrupts")} value={interruptLabel} onClick={() => setSubPanel("interrupt")} />
          <RowSubPanel icon={Zap} name={t("quickCreate.automation")} value={automationLabel} onClick={() => setSubPanel("automation")} />
          <RowSubPanel icon={Clock4} name={t("quickCreate.timedLabels")} value={timedLabelsLabel} onClick={() => setSubPanel("timed")} />
        </FormPanel>
        {error && (
          <div role="alert" className="text-sm text-danger">{error}</div>
        )}
        <div className="mt-4">
          <Button variant="primary" onClick={onSubmit} loading={loading} className="h-10 w-full rounded-md">
            {t("quickCreate.create")}
          </Button>
        </div>
      </SidePanel>
      {/* Sub-panel renderings — Task 58 */}
    </>
  );
}
```

**Step 3: Extract command builder to `build-command.ts`**

The submit logic in the old file is a giant `buildCommand(state)` function. Extract it verbatim to `src/components/tiles/build-command.ts`. No behavior change.

**Step 4: Preserve sub-panel state + handlers**

Copy the 4 sub-panel state objects (`recurrenceState`, `interruptState`, `automationState`, `timedLabelsState`) and their handlers from the old file. The new file references them but does not render the sub-panels yet (Task 58).

**Step 5: Run full test suite**

```bash
cd tastile-web && bun run test:unit
```

Expected: existing 201+ tests pass (most use `getByRole` and don't care about layout). Fix any failures by adjusting the new component, not the tests.

**Step 6: Browser-verify the base panel**

```bash
cd tastile-web && bun run dev
```

Open http://localhost:3000/dashboard/calendar. Click the "New" button. Verify:
- Panel renders with 24px internal padding
- All 11 rows are 48px tall (visually identical height)
- No text labels (only icons + placeholders/values)
- 4 sub-panel rows show "Off" / "Off" / "Prompt" / "None" as current values
- Submit button is at the bottom, standard size

Take a screenshot. Stop dev server.

**Step 7: Commit**

```bash
cd tastile-web && git add src/components/tiles/QuickTileCreate.tsx src/components/tiles/build-command.ts && git commit -m "refactor(tiles): rewrite QuickTileCreate base panel with form containers"
```

---

## Task 58: Rewrite 4 sub-panels

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx` (add sub-panel renderings)
- (No test changes expected)

**Step 1: Define sub-panel body components**

In `QuickTileCreate.tsx`, after the main `QuickTileCreate` component, define 4 small components:

```tsx
function RecurrenceSubPanel({ state, onChange, onClose }: RecurrenceSubPanelProps) {
  return (
    <SidePanel
      visible
      onCancel={onClose}
      hideFooter
      header={<SubPanelHeader title="Recurrence" onBack={onClose} />}
    >
      <FormPanel>
        <RowSegmented
          icon={Repeat}
          options={[
            { value: "normal", label: t("quickCreate.normal") },
            { value: "recurring", label: t("quickCreate.recurring") },
          ]}
          value={state.mode}
          onChange={(v) => onChange({ ...state, mode: v })}
        />
        {state.mode === "recurring" && (
          <>
            <RowInput icon={Calendar} placeholder="Pattern" value={state.pattern} onChange={(v) => onChange({ ...state, pattern: v })} />
            <RowInput icon={Clock} placeholder="Interval" value={state.interval} onChange={(v) => onChange({ ...state, interval: v })} />
            {/* ...other recurrence fields... */}
          </>
        )}
      </FormPanel>
    </SidePanel>
  );
}
```

Apply the same pattern to `InterruptSubPanel`, `AutomationSubPanel`, `TimedLabelsSubPanel`. Use the same row primitives.

**Step 2: Wire sub-panel rendering at the bottom of `QuickTileCreate`**

```tsx
{subPanel === "recurrence" && (
  <RecurrenceSubPanel state={recurrenceState} onChange={setRecurrenceState} onClose={() => setSubPanel(null)} />
)}
{/* ...same for other 3... */}
```

**Step 3: Run full test suite**

```bash
cd tastile-web && bun run test:unit
```

Expected: 201+ tests passing.

**Step 4: Browser-verify each sub-panel**

```bash
cd tastile-web && bun run dev
```

For each of the 4 sub-panel rows in the base panel, click to open. Verify:
- Sub-panel renders with 24px padding
- All rows are 48px
- Layout matches the base panel
- Back button returns to the base panel
- Sub-panel state is preserved when going back and re-entering

Take a screenshot per sub-panel. Stop dev server.

**Step 5: Commit**

```bash
cd tastile-web && git add src/components/tiles/QuickTileCreate.tsx && git commit -m "refactor(tiles): rewrite 4 sub-panels with form containers"
```

---

## Task 59: Verification

**Step 1: Run full test suite**

```bash
cd tastile-web && bun run test:unit
```

Expected: 201+ tests passing (no regressions).

**Step 2: Run typecheck**

```bash
cd tastile-web && bun run typecheck
```

Expected: clean (no output).

**Step 3: Run lint**

```bash
cd tastile-web && bun run lint
```

Expected: clean (no output).

**Step 4: Browser visual check**

```bash
cd tastile-web && bun run dev
```

Open http://localhost:3000/dashboard/calendar. Open QuickTileCreate. Verify:
- Panel internal padding is 24px (visually)
- All 11 rows are visually identical in height (48px)
- Icons are 20px and consistent
- No text labels visible
- Sub-panel rows show "Off" / "Off" / "Prompt" / "None" + chevrons
- Submit button is a standard button (not a pill)
- All 4 sub-panels open correctly and use the same layout
- No Tailwind compile errors in terminal

Take final screenshot.

**Step 5: Stop dev server, commit any remaining changes**

```bash
cd tastile-web && git status
```

If clean, no commit needed. If any small fixes were made, commit them.

**Step 6: Final summary**

Report to the user:
- 6 commits (54-59)
- 201+ tests passing
- typecheck clean
- lint clean
- Screenshot of redesigned QuickTileCreate
- List of follow-up tasks (migrate other components, add ESLint rule)
