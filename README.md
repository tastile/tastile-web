# tastile-web

Browser-based companion for the Tastile execution-control system.

This repository is not the primary Tastile product. The source of truth for the broader system is the Windows-first stack described in [AGENTS.md](./AGENTS.md): `tastile-core` owns the execution model, `tastile-desktop` is the main client, and `tastile-web` provides a browser/PWA companion plus web surfaces such as billing and dashboard access.

## Repository Goals

- Keep the web client aligned with Tastile's command/event/reducer architecture
- Make the repository reproducible for a fresh clone without tribal knowledge
- Maintain a clear quality gate for contributors before code is merged or deployed
- Keep the public download route pointed at the current desktop installer manifest

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase
- Vitest
- Playwright
- Tailwind CSS v4

## Project Layout

```text
src/
  app/          Next.js routes and API handlers
  components/   Reusable UI
  lib/
    core/       Commands, events, reducers, validation
    domain/     Domain types
    hooks/      Execution engine integration
    storage/    Supabase persistence
    supabase/   Browser/server Supabase clients
  wasm/         Generated WASM bridge artifacts
supabase/
  migrations/   Database schema and policy changes
scripts/        Repository automation
docs/plans/     Implementation and hardening plans
e2e/            Playwright coverage
```

## Prerequisites

- Node.js 20.11 or newer
- npm 10 or newer
- Optional: `wasm-pack` and a sibling checkout of `../tastile-core` if you want to rebuild the WASM bridge locally

## Environment

Copy `.env.local.example` to `.env.local` and fill in the required values.

Core variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Additional pricing and analytics variables are documented in `.env.local.example`.

Desktop download and versioning are resolved from the public installer manifest by default

- `TASTILE_DESKTOP_MANIFEST_URL` optionally overrides the manifest URL
- `NEXT_PUBLIC_TASTILE_DESKTOP_VERSION` and `TASTILE_DESKTOP_VERSION` are kept only for compatibility

## Installation

```bash
npm ci
```

## Development

Run the app locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Gates

Fast local validation:

```bash
npm run check
```

Release-level validation:

```bash
npm run check:release
```

This runs:

- ESLint
- TypeScript type checking
- Vitest unit tests
- Production build

Run browser coverage separately:

```bash
npm run test:e2e
```

## WASM Bridge

`npm run build` always invokes `npm run build:core-wasm` first.

There are two valid development modes:

1. Sibling `../tastile-core` checkout exists and `wasm-pack` is installed  
   The bridge is rebuilt from source.
2. No sibling checkout exists, but prebuilt artifacts are already committed in `src/wasm/tastile-core-wasm/pkg`  
   The build reuses those artifacts and continues.

If you want to require a fresh local rebuild, run with:

```bash
TASTILE_FORCE_WASM_BUILD=1 npm run build
```

## Contribution Expectations

- Read `AGENTS.md` before changing domain or architecture code
- Prefer focused commits
- Do not introduce alternate state models that bypass the command/event/reducer flow
- Keep `/dashboard` as the main authenticated web surface unless there is a clear product reason otherwise
- Run `npm run check` before opening a PR

## Current Constraints

- Some architecture alignment work is still in progress; see `docs/plans/` for active hardening plans
- The web app currently supports both daemon-backed and WASM-backed execution paths; treat backend switches carefully

## Deployment

This project is intended to deploy on Vercel or an equivalent Next.js hosting environment.

Minimum pre-deploy checklist:

```bash
npm run check:release
npm run test:e2e
```
