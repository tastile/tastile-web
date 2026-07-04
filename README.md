# tastile-web

Browser-based companion for the Tastile execution-control system.

This repository is a thin frontend client for the Tastile execution-control system. The source of truth for the broader system is `tastile-core` (backend API). `tastile-web` provides a browser/PWA interface for task I/O, notifications, and project management, plus web surfaces such as billing and dashboard access.

## Repository Goals

- Keep the web client aligned with Tastile's command/event/reducer architecture
- Make the repository reproducible for a fresh clone without tribal knowledge
- Maintain a clear quality gate for contributors before code is merged or deployed
- Keep the public download route pointed at the current desktop installer manifest

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- AWS (Cognito Hosted UI + tastile-core API)
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
    storage/    tastile-core API persistence
scripts/        Repository automation
docs/plans/     Implementation and hardening plans
e2e/            Playwright coverage
```

## Prerequisites

- Node.js 20.11 or newer
- Bun 1.3 or newer


## Environment

Copy `.env.local.example` to `.env.local` and fill in the required values.

Core variables:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=https://tastile.app
TASTILE_DESKTOP_MANIFEST_URL=
NEXT_PUBLIC_TASTILE_DESKTOP_VERSION=
TASTILE_DESKTOP_VERSION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

Additional variables (including AWS Cognito / `tastile-core` API keys added by the AWS integration) are documented in `.env.local.example`.

Desktop download and versioning are resolved from the public installer manifest by default

- `TASTILE_DESKTOP_MANIFEST_URL` optionally overrides the manifest URL
- `NEXT_PUBLIC_TASTILE_DESKTOP_VERSION` and `TASTILE_DESKTOP_VERSION` are kept only for compatibility

## Installation

```bash
bun install
```

## Development

Run the app locally:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Gates

Fast local validation:

```bash
bun run check
```

Release-level validation:

```bash
bun run check:release
```

This runs:

- ESLint
- TypeScript type checking
- Vitest unit tests
- Production build

Run browser coverage separately:

```bash
bun run test:e2e
```

## Contribution Expectations

- Read `AGENTS.md` before changing domain or architecture code
- Prefer focused commits
- Do not introduce alternate state models that bypass the command/event/reducer flow
- Keep `/dashboard` as the main authenticated web surface unless there is a clear product reason otherwise
- Run `bun run check` before opening a PR

## Current Constraints

- Some architecture alignment work is still in progress; see `docs/plans/` for active hardening plans
- The web app uses tastile-core API for execution

## Deployment

This project is intended to deploy on AWS (Web 汎用サーバー).

Minimum pre-deploy checklist:

```bash
bun run check:release
bun run test:e2e
```
