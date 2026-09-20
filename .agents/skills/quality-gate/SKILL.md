---
name: quality-gate
description: Run the full quality gate after any implementation task. Covers Biome syntax check, ESLint, typecheck, Knip dead-code analysis, Vitest unit/component tests, and build verification. Use at task completion or when asked to verify changes.
---

# Quality Gate

Standard completion condition for every implementation task in tastile-web.

## Workflow

### 1. Run the full gate

```bash
bun run check
```

This runs (in order): `lint:biome` → `lint` (ESLint) → `typecheck` → `knip` → `test:unit` (Vitest).

**All five must pass with zero errors and zero actionable warnings.**

### 2. If any step fails

- Read the error output carefully.
- Fix the root cause — do not suppress, skip, or add blanket ignores.
- Re-run `bun run check` from the beginning after each fix.

### 3. UI changes only — browser verification

If the change touches visible UI, run Playwright or take a screenshot to verify rendered output. Type-check and unit tests are not sufficient for UI completion.

```bash
bun run test:e2e
```

### 4. Release-ready (if shipping)

```bash
bun run check:release
```

This runs the full gate + `bun audit` + `bun run build:prod`.

## Blocking prohibitions

- No `.only`, skipped tests, disabled suites.
- No `|| true`, `--no-fail`, ignored exit codes.
- No blanket lint/type/suppression rules to pass.
- No coverage threshold reduction or file exclusion to fake numbers.
- No `bun run check:release` without user request — it runs destructive/deploy scripts.

## Coverage thresholds

When coverage is collected (`bunx vitest run --coverage`):

- lines >= 80%
- statements >= 80%
- functions >= 80%
- branches >= 80%

These are defined in `vitest.config.ts` and enforced by Vitest.

## Inherited tools

| Tool | Command | Purpose |
| --- | --- | --- |
| Biome | `bun run lint:biome` | Syntax-only check (linter/formatter disabled) |
| ESLint | `bun run lint` | Cross-cutting anti-patterns |
| TypeScript | `bun run typecheck` | Static type analysis |
| Knip | `bun run knip` | Unused deps/exports/files |
| Vitest | `bun run test:unit` | Unit/component tests |
| Playwright | `bun run test:e2e` | E2E browser tests |
| react-doctor | `bun run doctor` | React health score |
