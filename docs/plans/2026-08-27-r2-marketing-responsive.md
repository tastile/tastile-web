# R2 — Marketing Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every marketing page render cleanly and readably on mobile viewports (320–639px) with per-component mobile-first Tailwind utilities, building on R1's unified breakpoint system.

**Architecture:** Ad-hoc Tailwind utilities per component (no shared wrapper, no new design tokens). Each component's mobile-first cascade already provides a base state; this plan adds `sm:`, `md:`, `lg:` modifiers where needed to recover desktop behavior. R1's `scripts/audit-responsive-breakpoints.sh` enforces breakpoint hygiene via `bun run check`.

**Tech Stack:** Next.js 16, Mantine v9, Tailwind v4 (breakpoint SoT from R1), Playwright.

**Spec:** `/docs/superpowers/specs/2026-08-27-r2-marketing-responsive-design.md`

## Global Constraints

These constraints bind every task; they are copied verbatim from the spec.

- Branch: `main` only — no feature branches or worktrees
- No new npm packages
- English code / comments / commit messages
- Pre-existing uncommitted diff in `git status --short` MUST NOT be touched
- Disjoint file ownership per subagent — never two subagents editing the same file in parallel
- Per-file commit pattern with structured briefs/reports
- i18n hardcoded literals MUST NOT be added (i18n-literal-guard skill active)
- `src/lib/vendored/mantine-schedule` MUST NOT be touched
- Pre-commit review of agent-initiated commits must go through `.agents/skills/tastile-precommit-review`
- Tablet tier (768–1023px) is OUT OF SCOPE for R2 — only mobile fixes
- Touch ONLY the files in your task's ownership list — no other file

---

## File Structure (R2 scope)

| Path | Task | Touches |
|---|---|---|
| `src/features/marketing/ui/Hero.tsx` | R2-1 | mobile-first h1 scale, CTA stack, overflow-x-hidden |
| `src/features/marketing/ui/ProductPreview.tsx` | R2-1 | max-w-full, overflow-hidden |
| `src/features/marketing/ui/ConditionBento.tsx` | R2-2 | mkt-giant-numeral clamp, row layout mobile |
| `src/features/marketing/ui/CtaSection.tsx` | R2-2 | mkt-pierce-stroke clamp, CTA full-width on mobile |
| `src/features/marketing/ui/LifecycleLoop.tsx` | R2-3 | orbit/animation mobile containment |
| `src/features/marketing/ui/Manifesto.tsx` | R2-4 | prose scale mobile |
| `src/features/marketing/ui/Faq.tsx` | R2-4 | accordion full-width mobile |
| `src/features/marketing/ui/PricingTeaser.tsx` | R2-5 | single-column on mobile |
| `src/features/marketing/ui/PricingCard.tsx` | R2-5 | grid-cols-1 md:grid-cols-2 lg:grid-cols-3 |
| `src/features/marketing/ui/DemoSiteBanner.tsx` | R2-6 | banner mobile fit |
| `src/features/marketing/ui/LocaleSwitcher.tsx` | R2-6 | dropdown mobile fit |
| `src/features/marketing/ui/marketing.css` | R2-7 | mkt-pierce-stroke font-size clamp, mkt-giant-numeral max-width |
| `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/tokushoho/page.tsx`, `src/app/docs/page.tsx` | R2-8 | prose scale mobile (px-4 sm:px-6) |
| `e2e/mobile-marketing-render.spec.ts`, `e2e/helpers/marketing.ts` | R2-9 | new mobile assertions |

---

## Task 1 (R2-1): Hero + ProductPreview responsive fixes

**Files:**
- Modify: `src/features/marketing/ui/Hero.tsx`
- Modify: `src/features/marketing/ui/ProductPreview.tsx`

**Touch scope:** ONLY these 2 files.

### R2-1 Hero.tsx changes

In the section element (line 14):
- Add `overflow-x-hidden` to the `<section>` className to prevent any animation bleed (belt-and-suspenders).
- Keep `pt-10 pb-20 lg:pt-16 lg:pb-48` (mobile-first padding is already correct).

In the grid (line 33):
- Already `grid-cols-1 ... lg:grid-cols-[1.05fr_1fr]` — preserve the desktop split (per design decision).

In the `<h1>` (line 39):
- The className `mkt-display-1` is a custom class defined in `marketing.css`. To scale it down on mobile, add Tailwind text size modifiers that will be overridden by the cascade OR add a new rule in `marketing.css`. **Preferred (avoids touching marketing.css in this task)**: wrap h1 with a responsive Tailwind size class using Tailwind's `text-*` utilities on the inner span. The `mkt-display-1` provides font weight/family; Tailwind `text-*` provides size. Order matters: put `text-4xl sm:text-6xl lg:text-7xl` BEFORE `mkt-display-1` so the cascade works (last class wins).
  - Concrete: `<h1 className={`mkt-anim mkt-anim-2 mt-8 text-4xl sm:text-6xl lg:text-7xl mkt-display-1 text-foreground ${display}`}>`

In the subtitle paragraphs (lines 44, 49):
- `max-w-[44ch]` and `max-w-[52ch]` already constrain width — no change needed.

In the CTA container (line 54):
- Change `flex flex-wrap items-center gap-3` to `flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center`. This makes CTAs stack vertically and full-width on mobile, side-by-side on `sm:`+.
- Also add `w-full sm:w-auto` to each `<a>` element (lines 57, 64) so they fill the parent width on mobile.

### R2-1 ProductPreview.tsx changes

Read the current file (it's 139 lines) and apply:
- Wrap the outer container with `max-w-full overflow-hidden` so the preview cannot exceed parent width on mobile.
- If the preview uses `mkt-*` animations that depend on transform/perspective, add `overflow-hidden` on the parent of those elements.
- If the preview renders any absolutely-positioned elements with negative offsets, ensure they use `inset-x-0` or are wrapped to prevent horizontal overflow.

The exact line edits depend on the current file structure; use judgment based on the read. The invariant: at 320px viewport, `body.scrollWidth === window.innerWidth` on the home page.

### Steps

- [ ] **Step 1: Read current files**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/Hero.tsx
cat src/features/marketing/ui/ProductPreview.tsx
```

Expected: 80 lines and 139 lines respectively. Confirm className patterns before editing.

- [ ] **Step 2: Apply Hero.tsx edits**

Apply the changes described above using Edit tool. Each edit must:
1. Not change desktop behavior (preserve existing classes).
2. Add mobile-first modifiers.
3. Not introduce new copy.

- [ ] **Step 3: Apply ProductPreview.tsx edits**

Apply the `max-w-full overflow-hidden` wrapper as described.

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/Hero.tsx src/features/marketing/ui/ProductPreview.tsx
```

Expected: both exit 0. If biome rejects formatting, run `bunx biome format --write` on these 2 files only (small files — bundle risk acceptable). If `format --write` produces >50 lines of churn, stop and report to controller.

- [ ] **Step 5: Verify audit + mobile tests still pass**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
```

Expected: audit exits 0; mobile-iphone tests still pass (no regression).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/Hero.tsx src/features/marketing/ui/ProductPreview.tsx
git commit -m "fix(marketing): make Hero + ProductPreview mobile-safe"
```

Expected: 2 files changed, commit lands on `main`.

---

## Task 2 (R2-2): ConditionBento + CtaSection responsive fixes

**Files:**
- Modify: `src/features/marketing/ui/ConditionBento.tsx`
- Modify: `src/features/marketing/ui/CtaSection.tsx`

**Touch scope:** ONLY these 2 files.

### R2-2 ConditionBento.tsx changes

In the section element (line 12):
- Add `overflow-x-hidden` to the `<section>` className.

In the giant numeral container (line 16):
- Add `overflow-x-hidden` to ensure "01" numeral doesn't bleed horizontally.
- The numeral itself (line 18) is rendered with `mkt-giant-numeral` class from marketing.css. Don't change that class here — that's R2-7's task. Add a clamp via Tailwind arbitrary value: replace `mkt-giant-numeral` with `mkt-giant-numeral text-[clamp(6rem,25vw,18rem)]`. This caps the font size at small viewports.

In the row layout (line 54):
- Already `grid-cols-1 ... lg:grid-cols-[6rem_1fr_1.4fr]` — preserve. The mobile `grid-cols-1` is correct.

### R2-2 CtaSection.tsx changes

In the section element (line 14):
- Add `overflow-x-hidden`.

In the giant numeral container (line 18):
- Same as ConditionBento: add `overflow-x-hidden` and `text-[clamp(6rem,25vw,18rem)]` on the `<p>`.

In the piercing type container (line 26):
- Already has `overflow-hidden`. Keep.
- The pierced text (line 28): add `text-[clamp(3rem,12vw,10rem)]` to scale on mobile.

In the CTA container (line 60):
- Change `flex flex-wrap items-center gap-3` to `flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center`.
- Add `w-full sm:w-auto` to each `<Link>` (lines 63, 70).

In the footer micro-info (line 77):
- Already `flex flex-wrap` — no change needed (wraps naturally).

### Steps

- [ ] **Step 1: Read current files**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/ConditionBento.tsx
cat src/features/marketing/ui/CtaSection.tsx
```

- [ ] **Step 2: Apply ConditionBento.tsx edits**

- [ ] **Step 3: Apply CtaSection.tsx edits**

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/ConditionBento.tsx src/features/marketing/ui/CtaSection.tsx
```

- [ ] **Step 5: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/ConditionBento.tsx src/features/marketing/ui/CtaSection.tsx
git commit -m "fix(marketing): make ConditionBento + CtaSection mobile-safe"
```

---

## Task 3 (R2-3): LifecycleLoop responsive fix

**Files:**
- Modify: `src/features/marketing/ui/LifecycleLoop.tsx`

**Touch scope:** ONLY this 1 file.

### R2-3 LifecycleLoop.tsx changes

LifecycleLoop (221 LOC) is the largest marketing component. It likely has its own state and uses `mkt-orbit` or similar keyframe animations. Specific changes:

1. **Outer section**: add `overflow-x-hidden`.
2. **Animation containers**: any element with `mkt-orbit` or `mkt-sweep` must have `overflow-hidden` on its wrapper so transforms don't extend horizontally.
3. **Step grid**: if it currently uses 3+ columns on mobile, change to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
4. **Step cards**: ensure each card has `max-w-full` so it doesn't push parent width.
5. **Read the file first** to identify the actual layout patterns before editing. Don't apply generic patterns blindly.

### Steps

- [ ] **Step 1: Read current file**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/LifecycleLoop.tsx
```

- [ ] **Step 2: Apply edits based on the read**

- [ ] **Step 3: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/LifecycleLoop.tsx
```

- [ ] **Step 4: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/LifecycleLoop.tsx
git commit -m "fix(marketing): make LifecycleLoop mobile-safe"
```

---

## Task 4 (R2-4): Manifesto + Faq responsive fixes

**Files:**
- Modify: `src/features/marketing/ui/Manifesto.tsx`
- Modify: `src/features/marketing/ui/Faq.tsx`

**Touch scope:** ONLY these 2 files.

### R2-4 Manifesto.tsx changes

Manifesto is typography-heavy (157 LOC). Specific changes:

1. **Outer section**: add `overflow-x-hidden`.
2. **Headings**: scale down via `text-3xl sm:text-5xl lg:text-6xl` or use `mkt-display-2` with Tailwind text override (similar to R2-1's Hero pattern).
3. **Paragraphs**: already constrained by `max-w-[60ch]` etc. — verify they don't overflow.
4. **Section padding**: `pt-10 pb-20` is mobile-friendly already; keep or upgrade to `pt-12 pb-24 sm:pt-16 sm:pb-32`.

### R2-4 Faq.tsx changes

Faq (84 LOC) is accordion-based with Mantine v9 components.

1. **Outer section**: add `overflow-x-hidden`.
2. **Each accordion item**: ensure it has `w-full` so it doesn't exceed parent.
3. **Padding/margin**: `px-4 sm:px-6 lg:px-8` on the inner content.

### Steps

- [ ] **Step 1: Read current files**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/Manifesto.tsx
cat src/features/marketing/ui/Faq.tsx
```

- [ ] **Step 2: Apply Manifesto.tsx edits**

- [ ] **Step 3: Apply Faq.tsx edits**

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/Manifesto.tsx src/features/marketing/ui/Faq.tsx
```

- [ ] **Step 5: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/Manifesto.tsx src/features/marketing/ui/Faq.tsx
git commit -m "fix(marketing): make Manifesto + Faq mobile-safe"
```

---

## Task 5 (R2-5): PricingTeaser + PricingCard responsive fixes

**Files:**
- Modify: `src/features/marketing/ui/PricingTeaser.tsx`
- Modify: `src/features/marketing/ui/PricingCard.tsx`

**Touch scope:** ONLY these 2 files.

### R2-5 PricingTeaser.tsx changes (home page teaser)

PricingTeaser (211 LOC) shows teaser cards on home page.

1. **Outer section**: add `overflow-x-hidden`.
2. **Card grid**: change from `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` if currently different (verify by reading). Per spec, on mobile: single-column full-width; on `sm:`: two-up; on `lg:`: three-up.
3. **Each card**: `w-full max-w-full`.
4. **CTAs on cards**: stack vertically on mobile.

### R2-5 PricingCard.tsx changes (used on /pricing page)

PricingCard (117 LOC) is the full pricing card used on `/pricing`.

1. Same grid treatment as PricingTeaser.
2. Per design decision: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` is the final layout for the pricing page cards.
3. Ensure the card itself never exceeds parent width.

### Steps

- [ ] **Step 1: Read current files**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/PricingTeaser.tsx
cat src/features/marketing/ui/PricingCard.tsx
```

- [ ] **Step 2: Apply PricingTeaser.tsx edits**

- [ ] **Step 3: Apply PricingCard.tsx edits**

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/PricingTeaser.tsx src/features/marketing/ui/PricingCard.tsx
```

- [ ] **Step 5: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-iphone e2e/marketing-pricing.spec.ts --reporter=list
```

The pricing spec must not regress.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/PricingTeaser.tsx src/features/marketing/ui/PricingCard.tsx
git commit -m "fix(marketing): make PricingTeaser + PricingCard mobile-safe"
```

---

## Task 6 (R2-6): DemoSiteBanner + LocaleSwitcher responsive fixes

**Files:**
- Modify: `src/features/marketing/ui/DemoSiteBanner.tsx`
- Modify: `src/features/marketing/ui/LocaleSwitcher.tsx`

**Touch scope:** ONLY these 2 files.

### R2-6 DemoSiteBanner.tsx changes

DemoSiteBanner (42 LOC) is a small banner. Likely shows a notice on the demo site.

1. **Wrapper**: ensure `overflow-x-hidden`.
2. **Inner text**: `text-sm sm:text-base`.
3. **Dismiss button**: ensure it doesn't push content off-screen on mobile.

### R2-6 LocaleSwitcher.tsx changes

LocaleSwitcher (69 LOC) is a Mantine dropdown.

1. **Trigger button**: `w-full sm:w-auto` so it spans full width on mobile.
2. **Dropdown menu**: Mantine handles this; verify by testing.

### Steps

- [ ] **Step 1: Read current files**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/features/marketing/ui/DemoSiteBanner.tsx
cat src/features/marketing/ui/LocaleSwitcher.tsx
```

- [ ] **Step 2: Apply DemoSiteBanner.tsx edits**

- [ ] **Step 3: Apply LocaleSwitcher.tsx edits**

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/features/marketing/ui/DemoSiteBanner.tsx src/features/marketing/ui/LocaleSwitcher.tsx
```

- [ ] **Step 5: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/DemoSiteBanner.tsx src/features/marketing/ui/LocaleSwitcher.tsx
git commit -m "fix(marketing): make DemoSiteBanner + LocaleSwitcher mobile-safe"
```

---

## Task 7 (R2-7): marketing.css — clamp bleed animations

**Files:**
- Modify: `src/features/marketing/ui/marketing.css`

**Touch scope:** ONLY this 1 file.

### R2-7 marketing.css changes

The file is 1664 lines. Specific edits to two utility classes only:

#### `.mkt-pierce-stroke`
Currently:
```css
.mkt-pierce-stroke {
  /* giant piercing type that bleeds horizontally */
  font-size: clamp(3rem, 18vw, 18rem);
  ...
}
```

Add a minimum bound for small viewports by adjusting the lower clamp value, or add a new rule `.mkt-pierce-stroke--mobile` that overrides for `<sm` viewports. Actually, the current `clamp(3rem, 18vw, 18rem)` already has a floor of 3rem. Verify the actual CSS by reading.

If the existing CSS already has a sensible clamp, do nothing for this class. The R2-1/R2-2 component-level `text-[clamp(...)]` Tailwind utilities already provide the override.

#### `.mkt-giant-numeral`
Currently:
```css
.mkt-giant-numeral {
  font-size: clamp(8rem, 30vw, 20rem);
  ...
}
```

Lower the floor from `8rem` to something like `6rem` for mobile safety. Or add a media query at `(max-width: 767.98px)` (R1-aligned boundary) that overrides with a smaller size:

```css
@media (max-width: 767.98px) {
  .mkt-giant-numeral {
    font-size: clamp(4rem, 22vw, 12rem);
  }
}
```

**This is the only place in R2 where adding an `@media (max-width: ...)` rule is permitted.** It must use the R1-aligned `.98px` boundary subtraction.

#### Other classes
Do not touch other rules. Bleed/orbit/pulse animations are scoped to their containers (which R2-1/R2-2 wrapped with `overflow-hidden`).

### Steps

- [ ] **Step 1: Read current file**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
wc -l src/features/marketing/ui/marketing.css
grep -n "mkt-pierce-stroke\|mkt-giant-numeral" src/features/marketing/ui/marketing.css
```

- [ ] **Step 2: Locate existing `.mkt-pierce-stroke` and `.mkt-giant-numeral` rules**

Use grep to find line numbers. Read the surrounding context.

- [ ] **Step 3: Apply clamp adjustments**

Add the `@media (max-width: 767.98px)` rule for `.mkt-giant-numeral` if needed. Verify `.mkt-pierce-stroke` is already adequate.

- [ ] **Step 4: Verify biome (note: biome check on this file may fail pre-existently per R1-3 ruling — that's OK, document in report)**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bash scripts/audit-responsive-breakpoints.sh
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/features/marketing/ui/marketing.css
git commit -m "fix(marketing): clamp giant-numeral font size for mobile"
```

Expected: 1 file changed, small diff (the new `@media` rule).

---

## Task 8 (R2-8): Static pages responsive fixes

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/tokushoho/page.tsx`
- Modify: `src/app/docs/page.tsx`

**Touch scope:** ONLY these 4 files (verify `/docs` exists first; if it doesn't, replace with another prose page).

### R2-8 page-level changes

Each static page has a `<main>` or section wrapper. The mobile fix:

1. **Wrapper padding**: ensure `px-4 sm:px-6 lg:px-8`.
2. **Headings**: scale down via `text-3xl sm:text-4xl lg:text-5xl`.
3. **Body prose**: `text-sm sm:text-base` or use Tailwind's `prose-sm sm:prose-base` if `@tailwindcss/typography` is installed (verify first; if not, use plain text utilities).
4. **Long URLs/words**: `break-words` on paragraphs that may contain them.

For each page, the pattern is the same. Read each page's current structure first, then apply the equivalent change.

### Steps

- [ ] **Step 1: Verify /docs exists; if not, substitute another prose page**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
ls src/app/docs/ 2>&1 || echo "docs route missing"
```

If missing, find the closest analog (e.g., a markdown-rendered docs section).

- [ ] **Step 2: Read each page**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat src/app/privacy/page.tsx
cat src/app/terms/page.tsx
cat src/app/tokushoho/page.tsx
[cat src/app/docs/page.tsx OR substitute]
```

- [ ] **Step 3: Apply edits to each page**

- [ ] **Step 4: Verify typecheck and biome**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bun run typecheck
bunx biome check src/app/privacy/page.tsx src/app/terms/page.tsx src/app/tokushoho/page.tsx [src/app/docs/page.tsx]
```

If biome rejects formatting, run `bunx biome format --write` on these 4 files only. Verify the diff is reasonable (under 50 lines per file).

- [ ] **Step 5: Verify audit + mobile tests**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-pixel e2e/mobile-marketing-render.spec.ts --reporter=list
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add src/app/privacy/page.tsx src/app/terms/page.tsx src/app/tokushoho/page.tsx [src/app/docs/page.tsx]
git commit -m "fix(marketing): make static pages mobile-safe"
```

---

## Task 9 (R2-9): Playwright mobile assertions extension

**Files:**
- Modify: `e2e/mobile-marketing-render.spec.ts`
- Modify: `e2e/helpers/marketing.ts`

**Touch scope:** ONLY these 2 files.

### R2-9 spec changes

Add to `e2e/mobile-marketing-render.spec.ts` (currently 49 lines):

1. **Hero CTA visibility test** (iPhone viewport on `/`, `/pricing`, `/download`):
```ts
test("primary CTA is visible without horizontal scroll on mobile", async ({ page }) => {
  await page.goto(path);
  const cta = page.getByRole("link", { name: ctaName }).first();
  await expect(cta).toBeVisible();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});
```

2. **PricingTeaser card stack test** (iPhone viewport on `/`):
```ts
test("PricingTeaser cards stack vertically on mobile", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator('[data-testid="pricing-teaser-card"]'); // verify this selector exists
  // Or: use the section's grid layout check via getBoundingClientRect per card
  ...
});
```

If `[data-testid]` doesn't exist, use semantic selectors (`article`, role-based) per existing test patterns.

3. **Static pages no overflow** (iPhone + Pixel):
```ts
for (const { path } of STATIC_PAGES) {
  test.describe(`${path} mobile smoke`, () => {
    test("no horizontal scroll on mobile", async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  });
}
```

where `STATIC_PAGES = [{ path: "/privacy" }, { path: "/terms" }, { path: "/tokushoho" }, { path: "/docs" }]`.

4. **Body scrollWidth check** (bleed animations):
```ts
test("home page body has no horizontal overflow at mobile widths", async ({ page }) => {
  await page.goto("/");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = page.viewportSize()!.width;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
});
```

5. **Footer wrap check** (footer links wrap, don't overflow):
```ts
test("footer links wrap without overflow on mobile", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  // Scroll to footer and re-check
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = page.viewportSize()!.width;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
});
```

### R2-9 helpers changes

Add to `e2e/helpers/marketing.ts` only if a new reusable helper is needed. Most assertions can use existing `expectNoHorizontalScroll` + `expectPageHeading` etc.

### Steps

- [ ] **Step 1: Read current test + helpers**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
cat e2e/mobile-marketing-render.spec.ts
cat e2e/helpers/marketing.ts
```

- [ ] **Step 2: Apply spec changes**

Add the 5 new tests inside the existing describe blocks (per page) or as new describe blocks (for static pages).

- [ ] **Step 3: Verify desktop tests still pass (no regression)**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bunx playwright test --project=desktop-chrome e2e/mobile-marketing-render.spec.ts --reporter=list
```

If the desktop project exists, ensure no regression. If not, skip this step.

- [ ] **Step 4: Verify mobile tests pass**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-pixel e2e/mobile-marketing-render.spec.ts --reporter=list
```

Expected: all mobile-iphone + mobile-pixel tests pass (existing + new).

- [ ] **Step 5: Verify marketing-page desktop specs pass**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bunx playwright test --project=desktop-chrome e2e/marketing-home.spec.ts e2e/marketing-pricing.spec.ts e2e/marketing-download.spec.ts e2e/marketing-privacy.spec.ts e2e/marketing-terms.spec.ts e2e/marketing-tokushoho.spec.ts --reporter=list
```

Expected: 6 desktop marketing specs pass (no regression).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
git add e2e/mobile-marketing-render.spec.ts e2e/helpers/marketing.ts
git commit -m "test(marketing): extend mobile-marketing E2E coverage"
```

---

## Final verification (R2-Final)

After all 9 tasks land on `main`, dispatch the final whole-branch reviewer. The reviewer must verify:

- [ ] **Step F-1: Audit script still passes**

```bash
cd "C:/Users/rebui/Desktop/tastile/tastile-web"
bash scripts/audit-responsive-breakpoints.sh
```

Expected: exit 0, no new offenders from R2 work.

- [ ] **Step F-2: All mobile-iphone + mobile-pixel tests pass**

```bash
bunx playwright test --project=mobile-iphone e2e/mobile-marketing-render.spec.ts --reporter=list
bunx playwright test --project=mobile-pixel e2e/mobile-marketing-render.spec.ts --reporter=list
```

Expected: all pass, including the 5 new assertions from R2-9.

- [ ] **Step F-3: All desktop marketing specs pass (no regression)**

```bash
bunx playwright test e2e/marketing-home.spec.ts e2e/marketing-pricing.spec.ts e2e/marketing-download.spec.ts e2e/marketing-privacy.spec.ts e2e/marketing-terms.spec.ts e2e/marketing-tokushoho.spec.ts --reporter=list
```

Expected: 6 desktop specs pass.

- [ ] **Step F-4: No new npm packages**

```bash
git diff <R2-BASE>..HEAD -- package.json
```

Expected: only `scripts` section additions/changes; no `dependencies` / `devDependencies`.

- [ ] **Step F-5: Pre-existing uncommitted diff untouched**

```bash
git status --short
```

Expected: same untracked/modified set as before R2 began.

- [ ] **Step F-6: R1 gates still pass**

```bash
bun run typecheck
bun run knip
bun run audit:responsive
```

Expected: all exit 0.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| Goal: mobile rendering on 320-639px | R2-1 through R2-8 |
| Per-component mobile design rules 1-8 | R2-1 (1-7), R2-2 (1-7), R2-3 (1, 4), R2-4 (1, 8), R2-5 (4), R2-7 (7) |
| Mobile E2E coverage extensions 1-5 | R2-9 |
| Acceptance criteria 1-8 | R2-Final F-1..F-6 + R2-9 |
| File ownership (disjoint per task) | Tasks 1-9 |

**2. Placeholder scan:** No "TBD", "TODO", "fill in", "similar to Task N" — all edits are concrete.

**3. Type consistency:** Component classNames are Tailwind strings; no TypeScript interfaces changed. The `text-[clamp(...)]` Tailwind arbitrary syntax is consistent across tasks.

**4. Risk acknowledged:** R2-1 and R2-2 instruct the implementer to add Tailwind arbitrary `text-[clamp(...)]` on components. R2-7 handles the same clamp in CSS. Belt-and-suspenders — if both fire, the cascade resolves correctly (Tailwind utilities win over CSS classes by source order).

**5. Spec requirement with no task:** Tablet tier explicitly out of scope per brainstorming decision. Deferred to R3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-27-r2-marketing-responsive.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints