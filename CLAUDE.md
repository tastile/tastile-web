# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Read These First

**Before doing ANYTHING in this codebase, you MUST read:**

1. **`../tastile-root/docs/HARNESS.md`** - Tastile プロジェクト全体の方針
2. **`../tastile-core/v1/02-core-entities.md`** - v1 ドメインモデル (Tile / Plan / Placement / Execution)
3. **`../tastile-core/v1/10-invariants.md`** - 不変条件
4. **`../tastile-core/v1/14-read-model-and-endpoint.md`** - API 仕様

**tastile-core/v1/ が唯一の仕様正本。旧 pomodoroom/CORE_POLICY.md や tastile_docs_bundle/ は廃止済み。**

## Project Context

**tastile-web** is a **browser-based companion** to the primary Tastile execution control system.

### The Tastile Ecosystem

Tastile v1's **primary platform is Windows PC** (not web):
- **tastile-core** (Rust): The source of truth. Command/Event/Reducer engine, PostgreSQL storage, HTTP API
- **tastile-desktop** (C#/WinUI): Primary Windows client with OS-level intervention (focus capture, fullscreen prompts, system tray)
- **tastile-android** (Kotlin): Android companion
- **tastile-web** (this repo): **Minimal web implementation** that replicates core functionality in the browser via the AWS-hosted `tastile-core` API (Cognito Hosted UI for auth)

### tastile-web's Role

tastile-web is NOT the primary Tastile experience. It exists to:
1. Provide access when not on the Windows PC
2. Offer iOS PWA support (since native iOS is deferred)
3. Handle landing pages, billing, and web-accessible dashboard
4. Serve as a **proof that the architecture works browser-standalone**

**Critical misunderstanding to avoid:** This is not a "web app with desktop support". tastile-web is a **thin client** that consumes the tastile-core API.

## Architecture Philosophy

### Core Principles

1. **Execution Control, Not Task Management**
   - Tastile optimizes for execution friction reduction, not planning elegance
   - The goal: minimize "what should I do now?" decision cost

2. **v1 4 Aggregate モデル**
   - Tile / Plan / Placement / Execution の 4 集約で構成
   - 詳細は `../tastile-core/v1/02-core-entities.md`

3. **Facts, Not States**
   - Core stores **what happened** (events, timestamps), not **what status is** (running/paused/done)
   - `status` is a derived value, NOT a stored field
   - Lifecycle: `if completedAt != null => done; else if startedAt != null => started; else => ready`

4. **CLI-First, GUI-Second**
   - All business logic must be invocable via Command API
   - AI agents, automation, and humans use the **same Command surface**
   - UI is a thin presentation layer over Core

### Backend: AWS

- **Auth**: AWS Cognito Hosted UI (Google OAuth federated identity). Same sign-in flow as `tastile-desktop` — see `../tastile-desktop/CLAUDE.md` for connection model details.
- **API**: `tastile-core` (Rust daemon on EC2) over HTTPS. Web client is a thin presentation layer that issues Command API calls and consumes the resulting Events.
- **Database**: Postgres via tastile-core (no direct DB access from the web client).
- **Event sourcing**: Stored in tastile-core, not in a side-channel DB.
- **Sync**: Client ↔ tastile-core API (poll + SSE) for multi-device state propagation.
- **Billing**: Stripe webhooks via Next.js API routes.
- **File storage**: AWS S3 (e.g., desktop installer manifest).

Tokens issued by Cognito: `id_token` (JWT, sent as `Authorization: Bearer …`) plus `refresh_token` for silent renewal.

### Frontend Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Vitest for testing
- **No global state library** - AppState derived from events

### Event Sourcing Pattern (MANDATORY)

Web implementation MUST follow the same Command/Event/Reducer pattern as Rust Core:

```
Command (intent)
  ↓
Validation (can we accept this?)
  ↓
Event(s) generated (what actually happened)
  ↓
Event Store append (tastile-core API persistence)
  ↓
Reducer (derive new AppState from events)
  ↓
React re-render
  ↓
Sync via tastile-core API (poll + SSE) → other devices
```

**Absolute Rules:**
- NEVER mutate AppState directly
- NEVER store `status`, `running`, `active` as fields — these are **derived**
- Events are **facts** (TileStarted, TileCompleted), not UI actions (ButtonClicked)
- Each Command has an `actor` (human/agent/cron/loop/system)
- Events are immutable and append-only

Key file structure (must be created):
```
src/lib/
├── domain/          # v1 Tile model, Execution, Actor, IDs
├── core/
│   ├── command.ts   # Command types + envelope
│   ├── event.ts     # Event types + envelope
│   ├── state.ts     # AppState (derived from events)
│   ├── validate.ts  # Command validation rules
│   ├── handler.ts   # Command → Events generator
│   └── reducer/     # Event → AppState reducer
├── storage/
│   └── event-store.ts  # tastile-core API event persistence
└── hooks/
    └── use-execution-engine.ts  # React integration
```

### Route Structure
- `/` - Public landing
- `/dashboard/*` - Authenticated dashboard (main UI)
- `/app/*` - iOS PWA routes (mobile-optimized)
- `/api/*` - Next.js API routes (Stripe, downloads, etc.)

**Important**: Work with `/dashboard` routes, NOT `/app` routes, when building web dashboard features.

## Commands

### Development
```bash
bun dev          # Start dev server (http://localhost:3000)
bun run build    # Production build
bun run lint     # Run ESLint
bun test         # Run all tests with Vitest
bun test <file>  # Run specific test file
```

### Testing
```bash
bun test src/lib/storage/event-store.test.ts  # Test specific file
bun test --ui                                  # Interactive UI
```

## Critical Implementation Notes

### Absolute Prohibitions

1. **DO NOT use `_old/` directory** - Deprecated code, treat as archive
2. **DO NOT store derived state** - No `status`, `running`, `paused` fields in Tile
3. **DO NOT use `kind` string enums** - v1 では数値定数のみ
4. **DO NOT mutate AppState** - Only via Events through Reducer
5. **DO NOT create UI-specific Commands** - Commands must be domain-level (not "ClickedButton")
6. **DO NOT give AI special backdoor APIs** - AI uses same Command surface as humans

### tastile-core API
- All requests authenticated with `Authorization: Bearer <id_token>` (Cognito JWT)
- The `events` log is append-only; clients never issue UPDATE/DELETE on events
- Multi-device sync is delegated to tastile-core (poll + SSE); clients do not implement their own sync layer
- Database schema lives in `tastile-core` — see `../tastile-core/CLAUDE.md`

### Mock Data vs Real Data
Current UI components use `src/lib/mock-data.ts`. When implementing features:
1. Replace mock imports with real `tastile-core` API client calls
2. Use `useExecutionEngine()` hook for state management
3. Connect to actual `EventStore` and `AppState`

### State Management
- Local component state: React `useState`
- Global UI state (modals, theme): Zustand stores in `src/lib/stores/`
- Execution engine state: `use-execution-engine.ts` hook (replays events into AppState)

### Sync Model
- **Tiles**: Cloud-authoritative, local cache
- **Events**: Append-only, ordered by `occurred_at`
- **Settings**: Last-write-wins
- **Execution state** (active_tile, phase): NOT persisted by tastile-core across restarts (browser-local only)

## Current Implementation Status

As of 2026-06-18:
- ✅ `tastile-core` API client skeleton (`src/lib/core/`)
- ✅ `EventStore` stub for persistence (`src/lib/storage/event-store.ts`)
- ⚠️ `use-execution-engine` hook exists BUT references non-existent imports
- ✅ Dashboard shell UI (`/dashboard`) - **uses mock data**
- ❌ **Domain model NOT implemented** - v1 Tile model 未実装
- ❌ **Command/Event/Reducer NOT implemented** - Core engine missing
- ❌ **AppState derivation NOT implemented** - No event replay logic

**The execution engine described in progress reports was NEVER committed to this repo.**

### What Actually Needs To Be Built

To connect UI to real data, you must:
1. v1 Tile ドメインモデルの実装 - see tastile-core/v1/02-core-entities.md
2. Implement Command types (StartTile, CompleteTile, etc.) - see doc 04
3. Implement Event types (TileStarted, TileCompleted, etc.) - see doc 04
4. Implement Validator (command acceptance rules)
5. Implement Reducer (events → AppState transformation)
6. Implement CommandHandler (command → validation → events → append → reduce)
7. Connect `use-execution-engine` to real types
8. Replace mock data in UI components with derived state from AppState

Refer to Rust Core implementation as reference (`tastile-core/crates/`).

## Required Reading (Project Docs)

These documents are THE source of truth:

### Foundation (MUST READ)
- `../tastile-root/docs/HARNESS.md` - プロジェクト全体方針
- `../tastile-core/v1/02-core-entities.md` - v1 ドメインモデル
- `../tastile-core/v1/10-invariants.md` - 不変条件
- `../tastile-core/v1/14-read-model-and-endpoint.md` - API 仕様

### Reference
- `../tastile-core/HARNESS.md` - バックエンド詳細ハーネス
- `../tastile-core/v1/` - v1 仕様群 (15 ファイル)

## Environment Variables

Required in `.env.local`:
```
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

See `.env.local.example` for reference. Auth-related AWS Cognito / `tastile-core` API keys are added as the AWS integration lands; they are intentionally not listed here until the corresponding source changes are merged.
