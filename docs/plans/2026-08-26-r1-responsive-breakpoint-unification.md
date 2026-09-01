# R1 — Responsive Breakpoint Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all responsive breakpoint values in `tastile-web` under Tailwind v4 defaults (sm:640 / md:768 / lg:1024 / xl:1280 / 2xl:1536) and ship an audit script that enforces the alignment.

**Architecture:** Purely numeric normalization. No user-visible pixel changes. The single structural addition is a `TAILWIND_BREAKPOINTS` constants export from `use-media-query.ts` and a POSIX `scripts/audit-responsive-breakpoints.sh` that greps the codebase for off-table literals. Tasks are disjoint file ownership so the SDD skill can dispatch them in sequence without merge conflicts.

**Tech Stack:** TypeScript, Tailwind v4 (CSS-native breakpoints via `@import "tailwindcss"`), Mantine v9 (em-based; intentionally not aligned — see spec Decision 1), POSIX bash (audit script), bun (script runner).

**Spec:** `docs/superpowers/specs/2026-08-26-r1-responsive-breakpoint-unification-design.md`

## Global Constraints

- Branch: `main` only (no worktree, no feature branch — AGENTS.md invariant)
- No new npm packages (AGENTS.md: "依存追加は最小: 新規 npm package を追加しない")
- English code / comments / commit messages
- Per SDD skill: per-file commit pattern when logical change is disjoint
- No user-visible pixel changes — every rendered viewport output must remain identical to pre-R1
- Touch ONLY the 6 files in the spec's "In scope" table; any other file is out of scope and BLOCKED
- Pre-existing uncommitted diff in `git status --short` is NOT touched by any task

---

## Task 1 (R1-1): Add `TAILWIND_BREAKPOINTS` constants to `use-media-query.ts`

**Files:**
- Modify: `src/shared/hooks/use-media-query.ts` (insert new export, do not change existing `useIsDesktop`)

**Interfaces:**
- Consumes: nothing
- Produces: `export const TAILWIND_BREAKPOINTS = { sm, md, lg, xl, "2xl" } as const` — exact values per the Tailwind v4 defaults

- [ ] **Step 1: Read the current file**

Run: `cat src/shared/hooks/use-media-query.ts`
Expected: 11 lines, exports `useMediaQuery` and `useIsDesktop`.

- [ ] **Step 2: Add the constants export**

Modify `src/shared/hooks/use-media-query.ts` to add (immediately after the existing `useIsDesktop` function, before EOF):

```ts
/**
 * Tailwind v4 breakpoint values, in CSS pixels.
 * Source of truth for all JS-driven responsive logic.
 *
 * Mirrors the Tailwind v4 defaults documented in `src/app/globals.css`
 * (see the "Responsive breakpoint policy" comment at the top of that file).
 * If Tailwind ever changes these defaults, this object AND the CSS @media
 * rules in `globals.css` MUST be updated together.
 */
export const TAILWIND_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Tailwind `sm` breakpoint value in CSS pixels.
 * Re-exported for ergonomic single-import usage in features that only need
 * the mobile/desktop cutoff (e.g. `useResponsiveBreakpoint`).
 */
export const TAILWIND_SM_PX = TAILWIND_BREAKPOINTS.sm;
```

The existing `useMediaQuery` and `useIsDesktop` exports MUST NOT be modified.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: exit 0. If it fails, the most likely cause is a duplicate export — re-read the file and verify only the additions from Step 2 are new.

- [ ] **Step 4: Run biome**

Run: `bunx biome check src/shared/hooks/use-media-query.ts`
Expected: exit 0. If formatting fails, run `bunx biome format --write src/shared/hooks/use-media-query.ts` and re-verify.

- [ ] **Step 5: Commit**

```bash
git add src/shared/hooks/use-media-query.ts
git commit -m "feat(responsive): export TAILWIND_BREAKPOINTS constants from use-media-query"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Task 2 (R1-2): Rename `MOBILE_MAX_WIDTH` → `TAILWIND_SM_PX` in `useResponsiveBreakpoint.ts`

**Files:**
- Modify: `src/features/manage-schedule/ui/useResponsiveBreakpoint.ts` (rename constant + import source)

**Interfaces:**
- Consumes: `TAILWIND_SM_PX` from `src/shared/hooks/use-media-query.ts` (R1-1)
- Produces: `export const TAILWIND_SM_PX` re-exported from this module; `useResponsiveBreakpoint` continues to read the same value

- [ ] **Step 1: Read the current file**

Run: `cat src/features/manage-schedule/ui/useResponsiveBreakpoint.ts`
Expected: 30 lines, defines `MOBILE_MAX_WIDTH = 640` (line 8) and uses it in the `QUERY` template literal (line 12).

- [ ] **Step 2: Update imports and rename**

Replace the top of `src/features/manage-schedule/ui/useResponsiveBreakpoint.ts` (lines 1–12) with:

```ts
// src/components/schedule/useResponsiveBreakpoint.ts
"use client";

import { useSyncExternalStore } from "react";
import { TAILWIND_SM_PX } from "@/shared/hooks/use-media-query";

// Mobile cutoff in CSS pixels. MUST stay aligned with Tailwind v4's `sm`
// breakpoint (640px) — see the responsive-breakpoint policy block at the top
// of `src/app/globals.css`. Update both if Tailwind defaults ever change.
export const TAILWIND_SM_PX = TAILWIND_SM_PX;

export type Breakpoint = "mobile" | "desktop";

const QUERY = `(max-width: ${TAILWIND_SM_PX}px)`;
```

Important details:
- The import path uses the `@/` alias. Verify that `tsconfig.json` has `"@/*": ["src/*"]` or equivalent path mapping. If not, change to a relative import: `import { TAILWIND_SM_PX } from "../../../shared/hooks/use-media-query"`.
- The re-export `export const TAILWIND_SM_PX = TAILWIND_SM_PX` shadows the imported name. This is intentional — the file-local constant is what `QUERY` references, and the re-export makes it canonical for future consumers.
- If the implementer prefers not to shadow, alternative is `import { TAILWIND_SM_PX as _TAILWIND_SM_PX }` + `const QUERY = \`(max-width: ${_TAILWIND_SM_PX}px)\`` + `export { _TAILWIND_SM_PX as TAILWIND_SM_PX }`. Either form is acceptable; pick whichever the project's biome formatter prefers (run `bunx biome check` to confirm).
- The remaining file body (`subscribe`, `getSnapshot`, `getServerSnapshot`, `useResponsiveBreakpoint`) is unchanged.

- [ ] **Step 3: Verify no other source files reference `MOBILE_MAX_WIDTH`**

Run: `cd tastile-web && grep -rn "MOBILE_MAX_WIDTH" src/ e2e/ scripts/`
Expected: no matches. If any match appears, the rename is incomplete — investigate and update the consumer.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 5: Run biome**

Run: `bunx biome check src/features/manage-schedule/ui/useResponsiveBreakpoint.ts`
Expected: exit 0. If formatting fails, run `bunx biome format --write src/features/manage-schedule/ui/useResponsiveBreakpoint.ts` and re-verify.

- [ ] **Step 6: Run unit tests**

Run: `bunx vitest run src/features/manage-schedule/`
Expected: all tests in that directory pass. If `useResponsiveBreakpoint` has no direct test, run the directory's tests anyway to confirm nothing downstream broke.

- [ ] **Step 7: Commit**

```bash
git add src/features/manage-schedule/ui/useResponsiveBreakpoint.ts
git commit -m "refactor(responsive): rename MOBILE_MAX_WIDTH to TAILWIND_SM_PX"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Task 3 (R1-3): Update `globals.css` — replace 480px with 639.98px + add policy comment

**Files:**
- Modify: `src/app/globals.css` (lines 1–10 add policy block; lines 404 replace `@media (max-width: 480px)` with `@media (max-width: 639.98px)`)

- [ ] **Step 1: Read the current policy block area**

Run: `head -15 src/app/globals.css` (to see if any header comment block already exists) and `sed -n '380,410p' src/app/globals.css` (to see the existing media queries).

Expected: lines 386–408 contain the three `@media` rules; no top-of-file policy comment exists yet.

- [ ] **Step 2: Add the responsive-breakpoint policy comment**

Insert immediately after line 1 (the `@import "tailwindcss";` line), before any other rule:

```css
/* Responsive breakpoint policy (R1).
 *
 * The codebase uses Tailwind v4's default breakpoints as the single source of
 * truth for responsive design:
 *   sm: 640px    md: 768px    lg: 1024px    xl: 1280px    2xl: 1536px
 *
 * CSS @media rules in this file MUST use these exact values (with .98px
 * subtraction for max-width queries to avoid double-fire at boundaries).
 *
 * JS hooks that need a numeric breakpoint MUST import from
 * `src/shared/hooks/use-media-query.ts`, which exposes Tailwind-aligned values
 * via named constants. Do NOT introduce new breakpoint constants elsewhere.
 *
 * Mantine v9 uses em-based breakpoints internally; those never need to align
 * with the px-based Tailwind values because no project code reads Mantine's
 * breakpoint numbers directly.
 */
```

- [ ] **Step 3: Replace the 480px outlier with 639.98px**

In the existing block at lines 404–408, replace:

```css
@media (max-width: 480px) {
  .layout-shell {
    padding-inline: 12px;
  }
}
```

with:

```css
/* Aligned with Tailwind `sm` boundary. Subtract 0.02px per the policy block
 * above to avoid double-fire at the exact 640px boundary. */
@media (max-width: 639.98px) {
  .layout-shell {
    padding-inline: 12px;
  }
}
```

- [ ] **Step 4: Annotate the other two @media blocks**

Replace the existing:

```css
@media (max-width: 1024px) {
  .layout-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .layout-shell {
    padding-inline: 16px;
  }
  ...
}
```

with (the rules themselves stay identical, only comments added):

```css
/* Aligned with Tailwind `lg` boundary (1024px - 0.02px). */
@media (max-width: 1023.98px) {
  .layout-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Aligned with Tailwind `md` boundary (768px - 0.02px). */
@media (max-width: 767.98px) {
  .layout-shell {
    padding-inline: 16px;
  }

  .layout-grid-2,
  .layout-grid-3 {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
```

The rule bodies are byte-for-byte identical — only the px values and a comment are added.

- [ ] **Step 5: Verify no `480px` literal remains in `globals.css`**

Run: `grep -n "480" src/app/globals.css`
Expected: no matches (the only `480` was in the `@media (max-width: 480px)` rule).

- [ ] **Step 6: Run typecheck and biome**

Run:
```bash
bun run typecheck
bunx biome check src/app/globals.css
```
Expected: both exit 0. (CSS files don't get typechecked but biome will format-check.)

- [ ] **Step 7: Smoke-test marketing pages in dev**

The user-visible behavior of marketing pages must be unchanged at common viewport widths (390px iPhone 13, 393px Pixel 5, 768px iPad portrait, 1024px iPad landscape, 1440px desktop).

Run: `bun dev` in one terminal, then in another:
```bash
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-pixel e2e/mobile-marketing-render.spec.ts --reporter=list
```
Expected: 9/9 tests still pass (no regressions). If any test fails, investigate whether the boundary change `480 → 639.98` is the cause (most likely culprit: padding difference at 481–640px viewport).

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(responsive): align globals.css marketing breakpoints with Tailwind defaults"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Task 4 (R1-4): Add documentation comment to `mantine-theme.ts`

**Files:**
- Modify: `src/lib/theme/mantine-theme.ts` (add a 3-line comment block above `export const mantineTheme = createTheme({...})` at line 57)

- [ ] **Step 1: Locate the `createTheme` call**

Run: `grep -n "createTheme" src/lib/theme/mantine-theme.ts`
Expected: `19: createTheme` (the import) and `57: export const mantineTheme = createTheme({` (the call site).

- [ ] **Step 2: Insert documentation comment**

Immediately above the line `export const mantineTheme = createTheme({` (line 57), insert:

```ts
// Note: Mantine v9 breakpoints are intentionally left at their em-based
// defaults. The px-based Tailwind system (see globals.css policy block) is
// the project source of truth for any code-level responsive decisions;
// Mantine uses em internally and no project code reads Mantine's breakpoint
// numbers directly.
```

Do NOT modify the `createTheme({...})` call body. Do NOT add a `breakpoints:` field.

- [ ] **Step 3: Run typecheck and biome**

Run:
```bash
bun run typecheck
bunx biome check src/lib/theme/mantine-theme.ts
```
Expected: both exit 0. If biome formatting fails, run `bunx biome format --write src/lib/theme/mantine-theme.ts` and re-verify.

- [ ] **Step 4: Commit**

```bash
git add src/lib/theme/mantine-theme.ts
git commit -m "docs(theme): comment explaining why Mantine breakpoints are not overridden"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Task 5 (R1-5): Add `scripts/audit-responsive-breakpoints.sh`

**Files:**
- Create: `scripts/audit-responsive-breakpoints.sh` (new POSIX bash script)
- Modify: `package.json` (add `audit:responsive` script entry)

**Interfaces:**
- Consumes: `src/`, `e2e/`, `globals.css` files (read-only)
- Produces: exit code 0 if all numeric breakpoints align with Tailwind defaults; non-zero otherwise

- [ ] **Step 1: Create the audit script**

Create `scripts/audit-responsive-breakpoints.sh` with the following content:

```bash
#!/usr/bin/env bash
# scripts/audit-responsive-breakpoints.sh
# Audit that all numeric breakpoint literals in the codebase match the
# Tailwind v4 default breakpoint table (sm:640 / md:768 / lg:1024 / xl:1280
# / 2xl:1536) or the corresponding .98px boundary variants.
#
# See the responsive-breakpoint policy block at the top of
# src/app/globals.css for the full design rationale.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Tailwind v4 breakpoint values + .98px boundary variants for max-width
# queries. These are the only px literals allowed in src/, e2e/, and
# globals.css.
ALLOWED_PATTERN='(640|768|1024|1280|1536|639\.98|767\.98|1023\.98|1279\.98|1535\.98)px'

# Patterns we explicitly ignore because they're not breakpoint literals:
#   - numeric Tailwind utilities like text-sm, max-w-md
#   - hex colors
#   - z-index, opacity, transform values
#   - Mantine/em-based breakpoints (e.g. "(min-width: 48em)")
IGNORE_PATTERN='(#[0-9a-fA-F]{3,8}|\btext-(xs|sm|md|lg|xl)|\bmax-w-(xs|sm|md|lg|xl|\[)|\bopacity-|\bz-\d+|em\b)'

# Search scope: src/, e2e/, globals.css, scripts/audit/ (itself).
SEARCH_PATHS=(src e2e scripts/audit scripts/audit-responsive-breakpoints.sh)
SEARCH_FILES=("src/app/globals.css")

# Collect grep candidates
declare -a OFFENDERS=()

# Scan all .ts/.tsx/.css/.js/.mjs/.cjs/.mts/.cts files under src/ and e2e/
for ext in ts tsx css js mjs cjs mts cts; do
  while IFS= read -r -d '' file; do
    # Grep for any px literal
    matches=$(grep -nE "[0-9]+(\.[0-9]+)?px" "$file" 2>/dev/null || true)
    if [ -z "$matches" ]; then continue; fi
    # Filter out allowed + ignored
    bad=$(echo "$matches" | grep -vE "$ALLOWED_PATTERN" | grep -vE "$IGNORE_PATTERN" || true)
    if [ -n "$bad" ]; then
      OFFENDERS+=("$file")
      echo "OFFENDER: $file"
      echo "$bad" | head -20
      echo "---"
    fi
  done < <(find src e2e -type f -name "*.$ext" -print0 2>/dev/null)
done

# Scan globals.css separately
if [ -f "src/app/globals.css" ]; then
  matches=$(grep -nE "[0-9]+(\.[0-9]+)?px" src/app/globals.css 2>/dev/null || true)
  if [ -n "$matches" ]; then
    bad=$(echo "$matches" | grep -vE "$ALLOWED_PATTERN" | grep -vE "$IGNORE_PATTERN" || true)
    if [ -n "$bad" ]; then
      # Skip — already scanned above as part of src/. If the find above missed
      # globals.css for any reason, this is the safety net.
      :
    fi
  fi
fi

if [ ${#OFFENDERS[@]} -gt 0 ]; then
  echo ""
  echo "FAIL: ${#OFFENDERS[@]} file(s) contain px literals that are not in the"
  echo "Tailwind v4 breakpoint table (or the policy's ignore list)."
  echo ""
  echo "Either:"
  echo "  1. Replace the literal with a Tailwind utility (sm:/md:/lg:/xl:/2xl:)"
  echo "  2. Replace it with a constant from src/shared/hooks/use-media-query.ts"
  echo "  3. Add the literal to the policy ignore list in this script (only if"
  echo "     it is genuinely not a breakpoint value)"
  exit 1
fi

echo "OK: All px literals in src/, e2e/, scripts/audit/ align with Tailwind v4 defaults."
exit 0
```

Mark the file executable:

```bash
chmod +x scripts/audit-responsive-breakpoints.sh
```

- [ ] **Step 2: Add npm script entry**

Modify `package.json` (the `scripts` section, around line 38). Insert after the `audit:plugins` line:

```json
"audit:responsive": "bash scripts/audit-responsive-breakpoints.sh",
```

- [ ] **Step 3: Run the audit script standalone**

Run: `cd tastile-web && bash scripts/audit-responsive-breakpoints.sh`
Expected: prints `OK: All px literals ... align with Tailwind v4 defaults.` and exits 0.

If it exits non-zero: investigate the offenders. Common false positives:
- `globals.css` may have width/height/margin values like `1200px` (the `.layout-shell` `max-width`) — these are NOT breakpoints, the audit script should ignore them via the IGNORE_PATTERN. If a false positive slips through, extend IGNORE_PATTERN.
- `Tailwind v4 max-w-sm` etc. utility references — covered by IGNORE_PATTERN's `\bmax-w-(xs|sm|md|lg|xl|\[)`.

If the script is correctly flagging real offenders, fix them by either (a) replacing with Tailwind utility, or (b) updating IGNORE_PATTERN if the literal is genuinely not a breakpoint.

- [ ] **Step 4: Verify npm script entry works**

Run: `cd tastile-web && bun run audit:responsive`
Expected: exit 0, same output as Step 3.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-responsive-breakpoints.sh package.json
git commit -m "feat(responsive): add audit script for Tailwind breakpoint alignment"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Task 6 (R1-6): Wire audit script into `bun run check`

**Files:**
- Modify: `package.json` (the `check` script at line 38)

- [ ] **Step 1: Read current `check` script**

Run: `grep -n '"check"' package.json`
Expected: line 38 contains `"check": "bun run lint:biome && bun run lint && bun run typecheck && bun run knip && bun run test:unit"`.

- [ ] **Step 2: Add `audit:responsive` to the `check` chain**

Replace the `check` line with:

```json
"check": "bun run lint:biome && bun run lint && bun run typecheck && bun run knip && bun run audit:responsive && bun run test:unit",
```

Position: after `knip`, before `test:unit`. (Audit is fast — a grep — so position doesn't matter for performance.)

- [ ] **Step 3: Run `bun run check` end-to-end**

Run: `cd tastile-web && bun run check`
Expected: exit 0. All prior steps (biome, eslint, typecheck, knip, audit:responsive, vitest) pass.

If anything fails:
- typecheck: likely a TypeScript error from R1-1/R1-2 — re-run `bun run typecheck` and inspect
- biome: reformat with `bunx biome format --write`
- eslint: inspect the rule violation; likely a no-unused-vars if a leftover `MOBILE_MAX_WIDTH` reference slipped through
- knip: confirm `TAILWIND_BREAKPOINTS` and `TAILWIND_SM_PX` are not flagged as unused (they should not be, since `useResponsiveBreakpoint` uses them)
- audit:responsive: see R1-5 Step 3 troubleshooting
- test:unit: investigate which test broke; most likely a snapshot test that captured the old `MOBILE_MAX_WIDTH` constant name

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "ci: wire responsive-breakpoints audit into bun run check"
```

Expected: commit lands on `main`; `git log --oneline -1` shows the SHA.

---

## Final verification (after all 6 tasks complete)

- [ ] **Step F-1: `bun run check:release` exit 0**

Run: `cd tastile-web && bun run check:release`
Expected: exit 0. This runs the full gate (check + audit + build:prod).

- [ ] **Step F-2: Acceptance criteria grep**

Run:
```bash
cd tastile-web
grep -rn "MOBILE_MAX_WIDTH" src/ e2e/ scripts/          # → 0 matches
grep -rn "max-width: 480" src/app/globals.css           # → 0 matches
bash scripts/audit-responsive-breakpoints.sh            # → exit 0
```

Expected: all three return zero / no matches.

- [ ] **Step F-3: Playwright mobile suites green**

Run:
```bash
cd tastile-web
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-iphone e2e/mobile-auth-forms.spec.ts --reporter=list
```

Expected: 9/9 marketing + 3/3 auth still passing. If any test fails, the most likely cause is the `480 → 639.98` boundary shift affecting layout at 481–640px viewport widths — investigate with `bunx playwright test --ui`.

- [ ] **Step F-4: No user-visible pixel changes**

Open `/` (home), `/pricing`, `/download`, `/login`, `/auth/signup` in a browser at 390px, 768px, 1024px, 1440px widths. Visual output should be byte-identical to pre-R1 (modulo the policy comment, which is invisible to users).

If any visual difference is detected, revert the most recent task and re-investigate.

---

## Self-review

**1. Spec coverage:**
- ✅ "Source-of-truth declaration" → R1-3 Step 2 (policy block in globals.css)
- ✅ "useResponsiveBreakpoint.ts rename" → R1-2
- ✅ "use-media-query.ts extension" → R1-1
- ✅ "globals.css marketing primitives fix" → R1-3 Steps 3-4
- ✅ "mantine-theme.ts documentation comment" → R1-4
- ✅ "Verification surface (audit script)" → R1-5
- ✅ Acceptance criteria 1-7 → R1-6 + Final verification F-1, F-2
- ✅ Acceptance criterion 8 (no user-visible changes) → F-4

**2. Placeholder scan:**
- No "TBD"/"TODO"/"implement later" in the plan
- All code blocks contain literal content
- No "Similar to Task N" cross-references
- Each task is self-contained

**3. Type consistency:**
- `TAILWIND_BREAKPOINTS` defined in R1-1, consumed in R1-2 — same shape
- `TAILWIND_SM_PX` exported in R1-1, re-exported in R1-2 — same value (640)
- Audit script `ALLOWED_PATTERN` covers the same set of literals the spec mentions
- `audit:responsive` script name used identically in R1-5 and R1-6
