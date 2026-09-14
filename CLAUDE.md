# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Canonical Contract

**Read [`AGENTS.md`](./AGENTS.md) first.** It is the canonical contract for this repository (v1 domain routing, sync model, prohibitions, implementation status, env vars, current constraints). Do not duplicate its content here — this file is only a Claude Code adapter.

The workspace-level contract that binds this child repository to `tastile-core`, `tastile-desktop`, `tastile-android`, and `tastile-brands` lives in `../AGENTS.md` and `../tastile-root/docs/HARNESS.md`.

## Claude Code Configuration Layout

- Claude Code settings/hooks: `.claude/settings.json` / `.claude/hooks/` (both intentionally
  absent — see [ADR-0005](../adr/0005-skills-and-mcp-extensions.md) for the rationale)
- Agent Skills (Codex-style, canonical): `.agents/skills/` — `react-doctor`,
  `tastile-precommit-review`, `i18n-literal-guard`
- Claude Code Skills (thin adapters): `.claude/skills/` (mirrors canonical, NOT a
  duplicate). Currently present:
  - `.claude/skills/i18n-literal-guard/SKILL.md` → `tastile-web/.agents/skills/i18n-literal-guard/`
  - `.claude/skills/tastile-precommit-review/SKILL.md` → `tastile-web/.agents/skills/tastile-precommit-review/`
    (precedence per [ADR-0011](../adr/0011-tastile-precommit-review-canonical-precedence.md))

The Skill adapter pattern is a thin wrapper under `.claude/skills/` that delegates to
`.agents/skills/`. Do not author new Skills in `.claude/skills/` without a corresponding
canonical entry in `.agents/skills/`. See [ADR-0011](../adr/0011-tastile-precommit-review-canonical-precedence.md)
for the precedence rule when canonicals exist in multiple repositories.

## Commands, Architecture, Quality Gate, Subagent Rules

Architecture / Commands / Quality Gate / Subagent Rules are the canonical contract of
[`AGENTS.md`](./AGENTS.md). This adapter does NOT duplicate those sections — read
AGENTS.md and reference [ADR-0011](../adr/0011-tastile-precommit-review-canonical-precedence.md)
for the canonical-location precedence rule.

The Claude Code-specific notes that DO live here (and not in AGENTS.md):

- Mantine v9 (`@mantine/core`, `@mantine/dates`, `@mantine/form`, `@mantine/hooks`) with
  Tailwind CSS v4 is the preferred UI primitive set — see
  `.claude/memory/feedback_mantine_first_ui.md` (auto-memory).
- React Compiler is enabled in `next.config.ts`. Avoid manual memoization (`useMemo`,
  `useCallback`) unless required by an external library that breaks under the compiler;
  the relevant react-doctor rule is disabled in `doctor.config.json` to reflect that.
- **No business logic in client** (mirrors AGENTS.md invariant, repeated here for the
  Claude-only session where AGENTS.md may not have been re-read after wake-up).

## Key Cross-References

- v1 domain spec: `../tastile-core/v1/` (Tile / Plan / Placement / Execution, invariants, read-model endpoints, API contracts)
- OpenAPI generated types: `src/lib/api/v1/openapi-generated.d.ts` (regenerate via `bun run generate-types`)
- Design system source of truth: `docs/DESIGN-SYSTEM.md`
- Linear-derived visual baseline: `docs/awesome-design-md/design-md/linear.app/DESIGN.md` (per `docs/decisions.md`)
- Architectural decisions log: `docs/decisions.md`
- Bridge auth contract for E2E: see `.agents/skills/tastile-precommit-review` SKILL.md for the security boundary list (Cognito, cookies, server-only secrets, Stripe, proxy)
- **E2E stack prerequisites**: `scripts/e2e/up-stack.sh` requires the `tastile-v1-api:latest` wslc image to already exist. Build it once with `bash ../tastile-core/scripts/wslc/build.sh` (or `.wslc/wslc-build.ps1`); on hosts where Defender blocks `cc1.exe` use CI `ubuntu-latest`. The troubleshooting table in `../tastile-core/scripts/wslc/README.md` is canonical.

## Next.js 16 Caveat

Next.js 16 has breaking changes — conventions, APIs, and file structure may differ from training data. Before writing route/handler code, read the relevant guide under `node_modules/next/dist/docs/`. Treat the agent-rules block automatically prepended at the end of `AGENTS.md` by `next dev` as canonical; do not strip it from committed work.

## Environment

Copy `.env.development.example` to `.env.development` (dev) or `.env.production.example` to `.env.production` (prod) and fill required values. Only `.env`, `.env.development`, and `.env.production` may carry real values; all other `.env*` files are gitignored.

Key variable groups:

- Stripe billing (`STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`)
- Desktop download/version (`TASTILE_DESKTOP_MANIFEST_URL`, `NEXT_PUBLIC_TASTILE_DESKTOP_VERSION`, `TASTILE_DESKTOP_VERSION`)
- AWS Cognito Hosted UI (`NEXT_PUBLIC_COGNITO_*`, `TASTILE_WEB_BRIDGE_SECRET`)
- `tastile-core` API (`CLOUD_API_BASE`, `NEXT_PUBLIC_DAEMON_BASE_URL`, `TASTILE_RUST_API_URL`, `TASTILE_USE_RUST_CORE`)
- Analytics + hosts (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_APEX_HOST`, `NEXT_PUBLIC_APP_HOST`)

`.env.local` is reserved for local-only overrides and is **not** loaded by the Vitest config on purpose — see the comment block in `vitest.config.ts` for why.

## Containerization

`Containerfile` (not `Dockerfile`) is the canonical image definition. Multi-stage: `oven/bun:1.3.14` build → `node:20-bookworm-slim` run, producing a Next standalone bundle (`output: "standalone"` in `next.config.ts`).

## Quality Gate (project-local invariants)

These are non-negotiable for any change that touches this repository:

1. `bun run check` passes with zero errors and zero unjustified warnings.
2. Knip reports no unused dependencies, exports, or files in the changed scope (broad ignores are forbidden).
3. Biome and ESLint both pass; do not silence rules project-wide to pass.
4. Vitest unit/component tests cover changed behavior; do not mark complete on a single happy-path test.
5. E2E changes (auth, billing, proxy, event behavior) require focused Playwright coverage and must respect `E2E_BYPASS_AUTH=0` unless the test is explicitly the bypass path.
6. UI changes must be verified in an actual rendered browser (Playwright or equivalent) before claiming completion — type-check and unit tests are not sufficient.
7. The release path (`bun run check:release`) is the only sanctioned signal for "ship-ready". `bun run check` is the iteration floor.

## Subagent / Parallelization Rules

See [`AGENTS.md`](./AGENTS.md) "Repository invariants" and the workspace canonical
[ADR-0007](../adr/0007-release-branch-and-ticket-workflow.md) + [ADR-0008](../adr/0008-structured-recovery-checkpoint.md).
Claude Code-specific addition: pre-commit reviewer MUST be Codex (or a sibling Claude
Code session with fresh context), not the same session that produced the diff. See
[ADR-0011](../adr/0011-tastile-precommit-review-canonical-precedence.md) for the
canonical-resolution precedence between the workspace generic and web-specific overlay.
