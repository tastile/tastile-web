# Dashboard UI Mantine Migration Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all Tailwind-based custom UI components with proper Mantine equivalents across the dashboard. Layout stays fixed. Only visible components change.

**Architecture:** Replace custom `Button`, `Card`, `Pill`, `EmptyState`, raw `<input>/<button>/<textarea>/<div error>` with Mantine primitives. The custom `@/components/ui/*` components are thin Tailwind wrappers that duplicate what Mantine already provides.

**Tech Stack:** Next.js 16, React 19, Mantine 8, TypeScript

---

## Problem Inventory

### A. Custom `Button` component (`src/components/ui/Button.tsx`)
- 229 lines of Tailwind cva variants duplicating Mantine Button
- Used across: `api/page.tsx`, `events/page.tsx`, `runtime/page.tsx`, `quota/page.tsx`
- **Replace with:** `@mantine/core` `Button` + `ActionIcon`

### B. Custom `Card` component (`src/components/ui/Card.tsx`)
- Already wraps Mantine `Paper` but adds Tailwind className everywhere
- `CardHeader`, `CardContent`, `CardFooter` are pure Tailwind divs
- **Replace with:** `@mantine/core` `Card` + `Card.Section`, or keep Paper wrapper but remove Tailwind

### C. Custom `Pill` component (`src/components/ui/StatusDot.tsx`)
- Pure Tailwind badge/chip, used in every dashboard page header
- **Replace with:** `@mantine/core` `Badge` or `Chip`

### D. Custom `EmptyState` component (`src/components/ui/Empty.tsx`)
- Pure Tailwind centered layout with icon/title/description
- **Replace with:** `@mantine/core` `Stack` + `Text` + `ThemeIcon`

### E. Custom `Dropdown` component (`src/components/ui/Dropdown.tsx`)
- Already wraps Mantine `Select` — just a thin adapter, can be inlined

### F. Raw HTML elements across pages
| Element | Files | Count |
|---------|-------|-------|
| `<button>` | api, timeline, layout-client | 7 |
| `<input>` | api, events | 4 |
| `<textarea>` | api | 1 |
| Error `<div>` | api, events, timeline, runtime, quota | 8 |
| Loading `<div>` | timeline, runtime, quota | 4 |

### G. Large Tailwind class strings
- `dashboard-shell.tsx`: 28 className instances
- `api/page.tsx`: 30+ className instances  
- `events/page.tsx`: 20+ className instances
- `timeline/[view]/page.tsx`: 40+ className instances

---

## Task 1: Replace custom Button with Mantine Button

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: every file that imports `@/components/ui/Button`

**Step 1: Rewrite Button.tsx as Mantine re-export**

```typescript
// src/components/ui/Button.tsx
"use client";

export { Button, ActionIcon, UnstyledButton, Anchor } from "@mantine/core";
export type { ButtonProps, ActionIconProps } from "@mantine/core";
```

This preserves the import path `@/components/ui/Button` for all existing consumers while the actual component is now Mantine. Consumers that pass `loading`, `variant="primary"`, `size="medium"` etc. will need their props adjusted in subsequent steps.

**Step 2: Fix imports in each consumer file**

Files to update:
- `src/app/dashboard/api/page.tsx`
- `src/app/dashboard/events/page.tsx`
- `src/app/dashboard/runtime/page.tsx`
- `src/app/dashboard/quota/page.tsx`

For each file, change:
```typescript
// Before:
import { Button } from "@/components/ui/Button";

// After:
import { Button, ActionIcon } from "@/components/ui/Button";
```

**Step 3: Fix Button props in api/page.tsx**

```typescript
// Before:
<Button variant="secondary" size="medium">
  <Code2 className="h-3.5 w-3.5" />
  Download OpenAPI
</Button>

// After:
<Button variant="default" size="sm" leftSection={<Code2 size={14} />}>
  Download OpenAPI
</Button>
```

```typescript
// Before:
<Button variant="primary" size="medium" onClick={run} loading={running} disabled={running}>
  <PlayCircle className="h-3.5 w-3.5" />
  Run request
</Button>

// After:
<Button variant="filled" size="sm" onClick={run} loading={running} disabled={running} leftSection={<PlayCircle size={14} />}>
  Run request
</Button>
```

```typescript
// Before:
<Button variant="secondary" size="medium" onClick={...}>
  <Copy className="h-3.5 w-3.5" />
  Copy as curl
</Button>

// After:
<Button variant="default" size="sm" onClick={...} leftSection={<Copy size={14} />}>
  Copy as curl
</Button>
```

**Step 4: Fix Button props in events/page.tsx**

```typescript
// Before:
<Button variant="secondary" size="medium" onClick={downloadJson} disabled={!list.length}>
  <Download className="h-3.5 w-3.5" />
  Download JSON
</Button>

// After:
<Button variant="default" size="sm" onClick={downloadJson} disabled={!list.length} leftSection={<Download size={14} />}>
  Download JSON
</Button>
```

```typescript
// Before:
<Button variant="secondary" size="medium" onClick={load} loading={loading}>
  <RefreshCw className="h-3.5 w-3.5" />
  Refresh
</Button>

// After:
<Button variant="default" size="sm" onClick={load} loading={loading} leftSection={<RefreshCw size={14} />}>
  Refresh
</Button>
```

```typescript
// Before:
<Button variant="secondary" size="small" onClick={onRetry}>
  <RefreshCw className="h-3 w-3" /> Retry
</Button>

// After:
<Button variant="subtle" size="compact-sm" onClick={onRetry} leftSection={<RefreshCw size={12} />}>
  Retry
</Button>
```

**Step 5: Fix Button props in runtime/page.tsx**

```typescript
// Before:
<Button variant="secondary" size="medium" onClick={load} loading={loading}>
  <RefreshCw className="h-3.5 w-3.5" />
  Refresh
</Button>

// After:
<Button variant="default" size="sm" onClick={load} loading={loading} leftSection={<RefreshCw size={14} />}>
  Refresh
</Button>
```

```typescript
// Before:
<Button variant="secondary" size="small" onClick={run} loading={loading}>
  {loading ? null : <Activity className="h-3 w-3" />}
  Probe
</Button>

// After:
<Button variant="default" size="compact-sm" onClick={run} loading={loading} leftSection={!loading ? <Activity size={12} /> : undefined}>
  Probe
</Button>
```

**Step 6: Fix Button props in quota/page.tsx**

```typescript
// Before:
<Button variant="secondary" size="medium" onClick={load} loading={loading}>
  <RefreshCw className="h-3.5 w-3.5" /> Refresh
</Button>

// After:
<Button variant="default" size="sm" onClick={load} loading={loading} leftSection={<RefreshCw size={14} />}>
  Refresh
</Button>
```

```typescript
// Before (line 203-209):
<Link href="/pricing" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
  <CreditCard className="h-3.5 w-3.5" />
  {plan === "pro" ? "Manage subscription" : "Upgrade to Pro"}
</Link>

// After:
<Button component={Link} href="/pricing" size="sm" leftSection={<CreditCard size={14} />}>
  {plan === "pro" ? "Manage subscription" : "Upgrade to Pro"}
</Button>
```

**Step 7: Fix Button props in preferences/account/page.tsx**

```typescript
// Before (line 176-183):
<Button component="button" radius="xl" size="xs" variant="subtle"
  className="bg-surface-3 text-foreground hover:bg-surface-2"
  title={t("preferences.account.refresh")}
  onClick={() => void loadProfile()}>
  <RefreshCw className="h-4 w-4" aria-hidden="true" />
</Button>

// After:
<ActionIcon variant="subtle" radius="xl" size="sm"
  title={t("preferences.account.refresh")}
  onClick={() => void loadProfile()}>
  <RefreshCw size={16} aria-hidden="true" />
</ActionIcon>
```

```typescript
// Before (line 193-197):
<Button onClick={() => setIsEmailModalOpen(true)} variant="subtle">
  <Edit className="h-4 w-4" aria-hidden="true" />
</Button>

// After:
<ActionIcon variant="subtle" size="sm" onClick={() => setIsEmailModalOpen(true)}>
  <Edit size={16} aria-hidden="true" />
</ActionIcon>
```

```typescript
// Before (line 246-252):
<Button type="submit" disabled={submitting}
  className="self-end rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60">
  {t("preferences.account.sendCode")}
</Button>

// After:
<Button type="submit" disabled={submitting} fullWidth>
  {t("preferences.account.sendCode")}
</Button>
```

```typescript
// Before (line 272-277):
<Button type="submit" disabled={submitting}>
  {t("preferences.account.verifyCode")}
</Button>

// After:
<Button type="submit" disabled={submitting}>
  {t("preferences.account.verifyCode")}
</Button>
```

**Step 8: Run typecheck**

Run: `bun run typecheck`
Expected: Fix any remaining type mismatches.

---

## Task 2: Replace raw `<button>` elements with Mantine ActionIcon/Button

**Files:**
- `src/app/dashboard/api/page.tsx` (3 raw buttons)
- `src/app/dashboard/timeline/[view]/page.tsx` (1 raw button)
- `src/app/dashboard/layout-client.tsx` (1 raw button)
- `src/app/dashboard/dashboard-shell.tsx` (5 raw buttons)

**Step 1: api/page.tsx — FilterChip button → Mantine Chip or Button**

```typescript
// Before (line 242-264):
function FilterChip({ active, onClick, children, count }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-7 ...", active ? "..." : "...")}>
      {children}
      {typeof count === "number" ? <span className={cn("rounded ...")}>{count}</span> : null}
    </button>
  );
}

// After:
import { Chip, Badge } from "@mantine/core";

function FilterChip({ active, onClick, children, count }) {
  return (
    <Chip
      checked={active}
      onChange={onClick}
      size="xs"
      variant="filled"
      radius="sm"
    >
      {children}
      {typeof count === "number" ? ` ${count}` : ""}
    </Chip>
  );
}
```

**Step 2: api/page.tsx — Close detail button → ActionIcon**

```typescript
// Before (line 327-334):
<button type="button" onClick={onClose}
  className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink-1"
  aria-label="Close detail">
  <X className="h-3.5 w-3.5" />
</button>

// After:
import { ActionIcon } from "@mantine/core";

<ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close detail">
  <X size={14} />
</ActionIcon>
```

**Step 3: api/page.tsx — Reset body button → UnstyledButton**

```typescript
// Before (line 401-407):
<button type="button" onClick={() => setBodyText(defaultBody(endpointKey))}
  className="text-[10px] text-ink-4 hover:text-ink-2">
  Reset
</button>

// After:
import { UnstyledButton, Text } from "@mantine/core";

<UnstyledButton onClick={() => setBodyText(defaultBody(endpointKey))}>
  <Text size="xs" c="dimmed">Reset</Text>
</UnstyledButton>
```

**Step 4: timeline/[view]/page.tsx — Create tile button → Mantine Button**

```typescript
// Before (line 233-239):
<button type="button"
  onClick={() => useQuickCreateStore.getState().openCreate({ initialAllDay: false })}
  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-fg">
  Create a tile
</button>

// After:
import { Button } from "@mantine/core";

<Button
  size="compact-sm"
  onClick={() => useQuickCreateStore.getState().openCreate({ initialAllDay: false })}
>
  Create a tile
</Button>
```

**Step 5: layout-client.tsx — Mobile FAB → Mantine ActionIcon + Paper**

```typescript
// Before (line 147-155):
<button type="button" aria-label={...} onClick={onClick}
  className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg hover:bg-primary-hover transition-transform active:scale-95 md:hidden animate-in fade-in zoom-in duration-200">
  <PanelLeftDashed className="h-5 w-5" />
</button>

// After:
import { ActionIcon } from "@mantine/core";

<ActionIcon
  variant="filled"
  size="xl"
  radius="xl"
  aria-label={t("dashboard.sidePanelOpenAria")}
  onClick={onClick}
  className="fixed bottom-6 right-6 z-40 md:hidden"
  style={{ boxShadow: 'var(--mantine-shadow-lg)' }}
>
  <PanelLeftDashed size={20} />
</ActionIcon>
```

---

## Task 3: Replace raw `<input>` elements with Mantine TextInput

**Files:**
- `src/app/dashboard/api/page.tsx` (3 inputs)
- `src/app/dashboard/events/page.tsx` (1 input)

**Step 1: api/page.tsx — Search input**

```typescript
// Before (line 121-127):
<input value={query} onChange={(e) => setQuery(e.target.value)}
  placeholder="Search endpoints, paths, keywords…"
  className="h-9 w-full rounded-md border border-border bg-surface-1 pl-8 pr-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-accent focus:ring-2 focus:ring-focus" />

// After:
import { TextInput } from "@mantine/core";

<TextInput
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search endpoints, paths, keywords…"
  leftSection={<Search size={14} />}
  size="sm"
/>
```

**Step 2: api/page.tsx — Path params inputs**

```typescript
// Before (line 370-377):
<input value={pathParams[name] ?? ""} onChange={...} placeholder={`{${name}}`}
  className="mt-1 h-8 w-full rounded-md border border-border bg-surface-0 px-2 font-mono text-xs text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-focus" />

// After:
<TextInput
  value={pathParams[name] ?? ""}
  onChange={(event) => setPathParams((current) => ({ ...current, [name]: event.target.value }))}
  placeholder={`{${name}}`}
  size="xs"
  styles={{ input: { fontFamily: 'var(--font-geist-mono)' } }}
/>
```

**Step 3: api/page.tsx — Query parameters input**

```typescript
// Before (line 386-391):
<input value={queryText} onChange={...} placeholder='{"limit": 20}'
  className="mt-1 h-8 w-full rounded-md border border-border bg-surface-0 px-2 font-mono text-xs text-ink-1 outline-none placeholder:text-ink-4 focus:border-accent focus:ring-2 focus:ring-focus" />

// After:
<TextInput
  value={queryText}
  onChange={(event) => setQueryText(event.target.value)}
  placeholder='{"limit": 20}'
  size="xs"
  styles={{ input: { fontFamily: 'var(--font-geist-mono)' } }}
/>
```

**Step 4: events/page.tsx — Search input**

```typescript
// Before (line 174-179):
<input value={query} onChange={(e) => setQuery(e.target.value)}
  placeholder="Search by type, id, actor, tile…"
  className="h-9 w-full rounded-md border border-border bg-surface-1 pl-8 pr-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-accent focus:ring-2 focus:ring-focus" />

// After:
<TextInput
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search by type, id, actor, tile…"
  leftSection={<Search size={14} />}
  size="sm"
/>
```

---

## Task 4: Replace raw `<textarea>` with Mantine Textarea

**Files:**
- `src/app/dashboard/api/page.tsx` (1 textarea)

**Step 1: api/page.tsx — Request body textarea**

```typescript
// Before (line 409-414):
<textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} spellCheck={false}
  className="h-44 w-full rounded-md border border-border bg-surface-0 p-2 font-mono text-[11px] text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-focus" />

// After:
import { Textarea } from "@mantine/core";

<Textarea
  value={bodyText}
  onChange={(e) => setBodyText(e.target.value)}
  spellCheck={false}
  h={176}
  styles={{ input: { fontFamily: 'var(--font-geist-mono)', fontSize: '11px' } }}
/>
```

---

## Task 5: Replace error display divs with Mantine Alert

**Files:**
- `src/app/dashboard/api/page.tsx` (1 error div)
- `src/app/dashboard/events/page.tsx` (ErrorState component)
- `src/app/dashboard/timeline/[view]/page.tsx` (1 error div)
- `src/app/dashboard/runtime/page.tsx` (ErrorRow component)
- `src/app/dashboard/quota/page.tsx` (1 error div + 1 warning div)

**Step 1: api/page.tsx — Response error**

```typescript
// Before (line 475-479):
{response && !response.ok ? (
  <div className="mt-2 rounded-md border border-status-danger/30 bg-status-danger-soft p-2 text-xs text-status-danger">
    {response.error.message}
  </div>
) : null}

// After:
import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

{response && !response.ok ? (
  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="sm" size="sm">
    {response.error.message}
  </Alert>
) : null}
```

**Step 2: events/page.tsx — ErrorState**

```typescript
// Before (line 330-357):
function ErrorState({ error, onRetry }) {
  if (!error) return <EmptyState ... />;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="text-sm font-semibold text-status-danger">{error.kind} · {error.status}</div>
      <p className="text-xs text-ink-3">{error.message}</p>
      <Button variant="secondary" size="small" onClick={onRetry}>Retry</Button>
    </div>
  );
}

// After:
import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

function ErrorState({ error, onRetry }) {
  if (!error) return <EmptyState ... />;
  return (
    <Alert icon={<IconAlertCircle size={16} />} title={`${error.kind} · ${error.status}`} color="red" variant="light">
      <Text size="sm" mb="sm">{error.message}</Text>
      <Button variant="subtle" size="compact-sm" onClick={onRetry} leftSection={<RefreshCw size={12} />}>
        Retry
      </Button>
    </Alert>
  );
}
```

**Step 3: timeline/[view]/page.tsx — Error display**

```typescript
// Before (line 224-227):
!data?.ok ? (
  <div className="p-6 text-sm text-status-danger">
    {data?.error.kind} · {data?.error.status} · {data?.error.message}
  </div>
) : ...

// After:
!data?.ok ? (
  <div className="p-6">
    <Alert icon={<IconAlertCircle size={16} />} title={`${data?.error.kind} · ${data?.error.status}`} color="red" variant="light">
      {data?.error.message}
    </Alert>
  </div>
) : ...
```

**Step 4: runtime/page.tsx — ErrorRow**

```typescript
// Before (line 329-341):
function ErrorRow({ error }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-danger/30 bg-status-danger-soft p-2.5 text-xs text-status-danger">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">{error.kind} · {error.status}</div>
        <div className="truncate">{error.message}</div>
      </div>
    </div>
  );
}

// After:
import { Alert, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

function ErrorRow({ error }) {
  return (
    <Alert icon={<IconAlertTriangle size={16} />} title={`${error.kind} · ${error.status}`} color="red" variant="light" size="sm">
      <Text size="xs" truncate>{error.message}</Text>
    </Alert>
  );
}
```

**Step 5: quota/page.tsx — Warning + Error displays**

```typescript
// Before (line 156-161) — warning:
{tilesPct >= 80 ? (
  <div className="mt-3 flex items-start gap-2 rounded-md border border-status-warn/30 bg-status-warn-soft p-2.5 text-xs text-status-warn">
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    Approaching your tile limit. Upgrade for more capacity.
  </div>
) : null}

// After:
import { Alert } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

{tilesPct >= 80 ? (
  <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" mt="sm" size="sm">
    Approaching your tile limit. Upgrade for more capacity.
  </Alert>
) : null}
```

```typescript
// Before (line 219-222) — session error:
session ? (
  <div className="mt-3 text-xs text-status-danger">
    {session.error.kind} · {session.error.status} · {session.error.message}
  </div>
) : ...

// After:
session ? (
  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="sm" size="sm">
    {session.error.kind} · {session.error.status} · {session.error.message}
  </Alert>
) : ...
```

---

## Task 6: Replace Pill with Mantine Badge

**Files:**
- `src/components/ui/StatusDot.tsx` — remove Pill export
- `src/app/dashboard/api/page.tsx`
- `src/app/dashboard/events/page.tsx`
- `src/app/dashboard/timeline/[view]/page.tsx`
- `src/app/dashboard/runtime/page.tsx`
- `src/app/dashboard/quota/page.tsx`

**Step 1: Replace Pill usage in all pages with Mantine Badge**

```typescript
// Before:
import { Pill } from "@/components/ui/StatusDot";
<Pill variant="active">
  <Database className="h-3 w-3" />
  Live · {liveBaseUrl()}
</Pill>

// After:
import { Badge } from "@mantine/core";
<Badge variant="light" color="green" size="sm" radius="xl" leftSection={<Database size={12} />}>
  Live · {liveBaseUrl()}
</Badge>
```

Variant mapping:
- `default` → `Badge variant="light" color="gray"`
- `accent` → `Badge variant="light" color="violet"`
- `active` → `Badge variant="light" color="green"`
- `warn` → `Badge variant="light" color="yellow"`
- `danger` → `Badge variant="light" color="red"`
- `done` → `Badge variant="light" color="teal"`
- `pending` → `Badge variant="light" color="blue"`

---

## Task 7: Replace EmptyState with Mantine Stack

**Files:**
- `src/components/ui/Empty.tsx`
- `src/app/dashboard/events/page.tsx`

**Step 1: Rewrite Empty.tsx**

```typescript
// Before:
export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 ...", className)}>
      {icon ? <div className="text-ink-3" aria-hidden>{icon}</div> : null}
      <h3 className="text-sm font-semibold text-ink-1">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-3">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

// After:
import { Stack, Text, ThemeIcon } from "@mantine/core";

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <Stack align="center" gap="md" py={48} px="md" className={className}>
      {icon ? <ThemeIcon variant="light" color="gray" size="lg" radius="md">{icon}</ThemeIcon> : null}
      <Text size="sm" fw={600}>{title}</Text>
      {description ? <Text size="sm" c="dimmed" maw={400} ta="center">{description}</Text> : null}
      {action}
    </Stack>
  );
}
```

---

## Task 8: Replace loading display divs with Mantine Loader/Center

**Files:**
- `src/app/dashboard/timeline/[view]/page.tsx`
- `src/app/dashboard/events/page.tsx`
- `src/app/dashboard/runtime/page.tsx`
- `src/app/dashboard/quota/page.tsx`

**Step 1: Create shared LoadingIndicator component**

```typescript
// src/components/ui/LoadingIndicator.tsx
import { Group, Loader, Text } from "@mantine/core";

export function LoadingIndicator({ label }: { label: string }) {
  return (
    <Group gap="sm" p="md">
      <Loader size="xs" />
      <Text size="sm" c="dimmed">{label}</Text>
    </Group>
  );
}
```

**Step 2: Replace loading divs in each file**

```typescript
// Before:
<div className="flex items-center gap-2 p-6 text-sm text-ink-3">
  <Loader2 className="h-4 w-4 animate-spin" /> Reading event log…
</div>

// After:
<LoadingIndicator label="Reading event log…" />
```

---

## Task 9: Replace large Tailwind class strings with Mantine styles

**Files:**
- `src/app/dashboard/api/page.tsx` — FilterChip, table headers
- `src/app/dashboard/events/page.tsx` — table headers, Field component
- `src/app/dashboard/timeline/[view]/page.tsx` — SummaryCard, BlockChip
- `src/app/dashboard/runtime/page.tsx` — Row, EnvRow, ProbeRow, EndpointChip

This task converts the remaining large className strings to Mantine `styles` prop or `sx` prop where appropriate. Focus on:

1. Table `<th>` elements → Mantine `Table` component or `styles` prop
2. `SummaryCard` → Mantine `Paper` + `Group` + `Text`
3. `BlockChip` → Mantine `Badge` or `Paper` with styles
4. `Field` → Mantine `Stack` + `Text`
5. `Row`, `EnvRow` → Mantine `Group` + `Text`

---

## Task 10: Clean up unused imports

**Files:**
- All modified files

After all replacements, remove unused Lucide icon imports (`Loader2`, `AlertTriangle`, etc.) that are no longer needed because Mantine components handle their own icons.

---

## Verification Checklist

- [ ] All `<button>` elements replaced with Mantine Button/ActionIcon/UnstyledButton
- [ ] All `<input>` elements replaced with Mantine TextInput
- [ ] All `<textarea>` elements replaced with Mantine Textarea
- [ ] All error displays use Mantine Alert
- [ ] All loading states use Mantine Loader
- [ ] All Pill/Badge usage migrated to Mantine Badge
- [ ] EmptyState uses Mantine Stack/Text
- [ ] No console errors
- [ ] TypeScript compiles
- [ ] Visual appearance preserved

---

## Testing Commands

```bash
bun run typecheck
bun run lint
bun run test:unit
bun dev
```

Manual checks:
- API page: search, filter chips, endpoint detail, error states
- Events page: search, error states, expand/collapse
- Timeline page: view switcher, empty state, error states
- Runtime page: probe buttons, error rows
- Quota page: progress bar, warning alert
- Dashboard shell: sidebar toggle, account menu
- Layout: mobile FAB, responsive behavior

---

## Commit Strategy

One commit per task:
```bash
git add -A && git commit -m "refactor(dashboard): task N — description"
```
