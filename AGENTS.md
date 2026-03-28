# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Read These First

**Before doing ANYTHING in this codebase, you MUST read:**

1. **`../pomodoroom/CORE_POLICY.md`** - The philosophical foundation inherited from Pomodoroom
2. **`../tastile_docs_bundle/tastile_docs/01_Foundation_and_Core_Principles.md`** - Tastile v1 foundation
3. **`../tastile_docs_bundle/tastile_docs/03_Domain_Model_and_Tile_Conditions.md`** - Tile structure
4. **`../tastile_docs_bundle/tastile_docs/04_Command_Event_and_Reducer_Model.md`** - Write model

**These documents define absolute constraints that override all implementation decisions.**

## Project Context

**tastile-web** is a **browser-based companion** to the primary Tastile execution control system.

### The Tastile Ecosystem

Tastile v1's **primary platform is Windows PC** (not web):
- **tastile-core** (Rust): The source of truth. Command/Event/Reducer engine, SQLite storage, local HTTP API
- **tastile-desktop** (C#/WinUI): Primary Windows client with OS-level intervention (focus capture, fullscreen prompts, system tray)
- **tastile-android** (Kotlin): Android companion
- **tastile-web** (this repo): **Minimal web implementation** that replicates core functionality in the browser using Supabase

### tastile-web's Role

tastile-web is NOT the primary Tastile experience. It exists to:
1. Provide access when not on the Windows PC
2. Offer iOS PWA support (since native iOS is deferred)
3. Handle landing pages, billing, and web-accessible dashboard
4. Serve as a **proof that the architecture works browser-standalone**

**Critical misunderstanding to avoid:** This is not a "web app with desktop support". This is a **desktop app with web companion support**.

## Architecture Philosophy

### Core Principles (from CORE_POLICY.md and Tastile docs)

1. **Execution Control, Not Task Management**
   - Tastile optimizes for execution friction reduction, not planning elegance
   - The goal: minimize "what should I do now?" decision cost

2. **Condition Vectors, Not Type Enums**
   - Tiles are NOT categorized by `kind` (e.g., "task", "break", "fixed")
   - Instead, each Tile has 7 condition layers: `core`, `work`, `temporal`, `objective`, `interruption`, `automation`, `annotation`
   - What looks like "types" in Pomodoroom are actually condition combinations

3. **Facts, Not States**
   - Core stores **what happened** (events, timestamps), not **what status is** (running/paused/done)
   - `status` is a derived value, NOT a stored field
   - Lifecycle: `if completedAt != null => done; else if startedAt != null => started; else => ready`

4. **CLI-First, GUI-Second**
   - All business logic must be invocable via Command API
   - AI agents, automation, and humans use the **same Command surface**
   - UI is a thin presentation layer over Core

### Backend: Supabase (Web-Only)

- **Auth**: Google OAuth
- **Database**: PostgreSQL with Row Level Security (RLS)
  - `profiles`: User profile data
  - `tiles`: Tile definitions (cloud authority for web; Rust Core uses SQLite)
  - `events`: **Event sourcing log** (append-only, ordered by `occurred_at`)
  - `user_settings`: User preferences
- **Realtime**: Multi-device sync via postgres_changes subscriptions
- **Edge Functions**: Stripe webhooks, integrations

**Important:** Windows version uses **local SQLite** as authority. Web version uses **Supabase** as authority.

### Frontend Stack
- Next.js 15 (App Router) + TypeScript
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
Event Store append (Supabase persistence)
  ↓
Reducer (derive new AppState from events)
  ↓
React re-render
  ↓
Realtime subscription → sync to other devices
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
├── domain/          # Tile model (7 condition layers), Execution, Actor, IDs
├── core/
│   ├── command.ts   # Command types + envelope
│   ├── event.ts     # Event types + envelope
│   ├── state.ts     # AppState (derived from events)
│   ├── validate.ts  # Command validation rules
│   ├── handler.ts   # Command → Events generator
│   └── reducer/     # Event → AppState reducer
├── storage/
│   └── event-store.ts  # Supabase event persistence
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

### Supabase Migrations
```bash
npx supabase db push              # Apply local migrations to remote
npx supabase db reset             # Reset local DB and apply migrations
npx supabase migration new <name> # Create new migration
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
3. **DO NOT use `kind` enums** - Use condition vectors instead
4. **DO NOT mutate AppState** - Only via Events through Reducer
5. **DO NOT create UI-specific Commands** - Commands must be domain-level (not "ClickedButton")
6. **DO NOT give AI special backdoor APIs** - AI uses same Command surface as humans

### Supabase Schema
- All tables have RLS policies scoped to `auth.uid() = user_id`
- `events` table is append-only (no UPDATE/DELETE in application code)
- Use `event_payload` column (not `payload_json`) for new code
- Indexes: `(user_id, occurred_at)`, `(user_id, sequence_number)`

### Mock Data vs Real Data
Current UI components use `src/lib/mock-data.ts`. When implementing features:
1. Replace mock imports with real Supabase queries
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
- **Execution state** (active_tile, phase): NOT stored in Supabase (browser-local only)

## Current Implementation Status

As of 2026-03-28:
- ✅ Supabase schema + migrations exist for `profiles`, `tiles`, and `events`
- ✅ `Tile` domain model, command/event types, validator, reducer, and `CommandHandler` are present under `src/lib/domain` and `src/lib/core`
- ✅ `use-execution-engine.ts` delegates to the daemon/WASM-backed execution hook
- ✅ `/dashboard` routes consume derived execution state through the execution engine context and dashboard projection
- ⚠️ The implementation still has architecture drift from the spec in places, especially around independent `Execution` snapshots, daemon/WASM compatibility layers, and quota/auth hardening
- ⚠️ Some dashboard and storage behavior still depends on compatibility projections rather than a fully spec-aligned tile-truth model

### What Still Needs Work

To move from "working branch" to "spec-aligned release candidate", focus on:
1. Reducing drift between the current `Execution` snapshot model and the tile-truth model in doc 03
2. Tightening Supabase quota/auth behavior so runtime guarantees match the repo docs
3. Removing remaining compatibility shortcuts in projection and storage code
4. Expanding tests around dashboard execution flows, prompt behavior, and migrations

Refer to Rust Core implementation as reference (`tastile-core/crates/`).

## Required Reading (Project Docs)

These documents are THE source of truth. Read them before implementing:

### Foundation (MUST READ)
- `../pomodoroom/CORE_POLICY.md` - Inherited philosophy and principles
- `../tastile_docs_bundle/tastile_docs/01_Foundation_and_Core_Principles.md` - Tastile v1 identity
- `../tastile_docs_bundle/tastile_docs/03_Domain_Model_and_Tile_Conditions.md` - Tile structure
- `../tastile_docs_bundle/tastile_docs/04_Command_Event_and_Reducer_Model.md` - Write model

### Reference Architecture
- `../docs/plans/2026-03-13-tastile-project-architecture.md` - Overall system design
- `../tastile-core/crates/` - Rust Core reference implementation

### Implementation Guides
- Other files in `../tastile_docs_bundle/tastile_docs/` (05-20) for specific subsystems

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

See `.env.local.example` for reference.
