# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Canonical Contract

**Read [`AGENTS.md`](./AGENTS.md) first.** It is the canonical contract for this repository (v1 domain routing, sync model, prohibitions, implementation status, env vars, current constraints). Do not duplicate its content here — this file is only a Claude Code adapter.

The workspace-level contract that binds this child repository to `tastile-core`, `tastile-desktop`, `tastile-android`, and `tastile-brands` lives in `../AGENTS.md` and `../tastile-root/docs/HARNESS.md`.

## Claude Code Configuration Layout

- Claude Code settings/hooks: `.claude/` (intentionally empty — no settings.json, no hooks/)
- Agent Skills (Codex-style, canonical): `.agents/skills/` (`react-doctor`, `tastile-precommit-review`)
- Claude Code Skills (thin adapters): `.claude/skills/`

The Skill adapter pattern: a thin wrapper under `.claude/skills/` that delegates to `.agents/skills/`. Do not author new Skills in `.claude/skills/` without a corresponding canonical entry in `.agents/skills/`.

## Commands

The package scripts in `package.json` are the source of truth. Canonical entry points:

| Purpose | Command |
| --- | --- |
| Dev server | `bun dev` |
| Production build (Next standalone) | `bun run build` |
| Production artifact | `bun run build:prod` |
| Fast local quality gate | `bun run check` (biome + eslint + typecheck + knip + vitest) |
| Release gate | `bun run check:release` (gate + audit + build:prod) |
| Biome only | `bun run lint:biome` |
| ESLint only | `bun run lint` |
| Type check only | `bun run typecheck` |
| Knip (dead-code) | `bun run knip` |
| Unit/component tests | `bun test` (single file: `bun test path/to/file.test.ts`) |
| Run all tests via project wrapper | `bun run test:unit` |
| E2E (Playwright) | `bun run test:e2e` |
| Regenerate OpenAPI types | `bun run generate-types` |
| React Doctor scan | `bun run doctor` |

`bun run check` is the standard completion gate; use focused scripts only during iterative development, never as the final gate.

## Architecture (current state)

This is a thin-client Next.js 16 dashboard for the `tastile-core` API. **Do not introduce business logic in the client** — all domain logic is owned by `tastile-core` and surfaced through the Command/Event/Reducer contract.

Directory layout follows Feature-Sliced Design (FSD):

- `src/app/` — Next.js App Router routes and API handlers (also legacy `/app/*` redirects to `/dashboard` via `next.config.ts`)
- `src/shared/` — cross-cutting primitives: `ui/`, `api/`, `lib/`, `i18n/`, `model/`, `auth/`, `stores/`, `query/`, `hooks/`, `analytics/`, `context/`
- `src/features/` — user-facing features: `create-tile`, `execute-tile`, `manage-tasks`, `manage-projects`, `manage-schedule`, `manage-settings`, `marketing`, `view-notifications`
- `src/widgets/` — composite UI blocks: `app-shell`, `activity-bar`, `floating-header`, `side-tool-panel`
- `src/views/` — page-level compositions (e.g. `dashboard/`)
- `src/{tile,execution,calendar}/` — domain slices, each with `model/` and `ui/`
- `src/lib/` — legacy/non-FSD infrastructure (kept for `account`, `api` clients, `billing`, `notifications`, `projection`, `scheduler`, `security`, `styles`, `theme`, `upstream`, `vendored`)

The historical `src/lib/{domain,core,storage,hooks}` layout from the early 2026 design docs has been superseded; the FSD plan in `docs/fsd-phase1-plan.md` documents the migration. Do not add new code to that legacy shape unless an existing module requires it.

UI library: **Mantine v9** (`@mantine/core`, `@mantine/dates`, `@mantine/form`, `@mantine/hooks`) with Tailwind CSS v4. Mantine is the preferred primitive for equivalent UI state and lifecycle behavior — see `.claude/memory/feedback_mantine_first_ui.md` (auto-memory).

React Compiler is enabled in `next.config.ts`. Avoid manual memoization (`useMemo`, `useCallback`) unless required by an external library that breaks under the compiler; the relevant react-doctor rule is disabled in `doctor.config.json` to reflect that.

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

## Subagent / Parallelization Rules (project-local)

- Local `main` only — do not create feature branches or worktrees.
- Disjoint file ownership per subagent; never let two subagents edit the same file in parallel.
- Commit operations are serialized; each subagent produces its own commit covering only its owned changes.
- Pre-commit review of agent-initiated commits must go through `.agents/skills/tastile-precommit-review`; do not self-approve.
