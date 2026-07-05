# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

バックエンドが核、フロントエンドは薄いクライアント:
- **tastile-core** (Rust): バックエンド全体。Command/Event/Reducer engine, PostgreSQL storage, HTTP API
- **tastile-web** (this repo): Web フロントエンド (薄いクライアント)
- **tastile-android** (Kotlin): Android フロントエンド (薄いクライアント)
- **tastile-desktop** (C#/WinUI): Windows フロントエンド (薄いクライアント)

### tastile-web's Role

tastile-web は tastile-core API の薄いフロントエンド。主な機能:
1. タスクの入出力・通知の Web UI
2. iOS PWA サポート (ネイティブ iOS は将来対応)
3. ランディングページ・課金・ダッシュボード
4. API ドキュメント等の Web 公開

**ビジネスロジックはフロントエンドに置かない。** すべて tastile-core API 経由で処理する。

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

### Backend: tastile-core API

- **Auth**: AWS Cognito Hosted UI (Google OAuth) + API トークン (Bearer)
- **API**: tastile-core (Rust/axum, AWS 上の API サーバー) が唯一のバックエンド
- **Database**: PostgreSQL (tastile-core 経由。Web クライアントから直接アクセスしない)
- **Billing**: Stripe (通知機能完成後に実装)

### Frontend Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Vitest for testing
- **No global state library** - AppState derived from events

### Event Sourcing Pattern (MANDATORY)

Web implementation MUST follow the same Command/Event/Reducer pattern as Rust Core:

```text
Command (intent)
  ↓
Validation (can we accept this?)
  ↓
Event(s) generated (what actually happened)
  ↓
Event Store append (persistence)
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
```text
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
│   └── event-store.ts  # Event persistence
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

### tastile-core API Schema
- Tile data served through tastile-core `/read/tiles` endpoint
- Commands executed through tastile-core `/commands/*` endpoints
- Execution state derived from tastile-core snapshot

### Mock Data vs Real Data
Current UI components use `src/lib/mock-data.ts`. When implementing features:
1. Replace mock imports with real tastile-core API queries
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
- **Execution state** (active_tile, phase): NOT stored in cloud (browser-local only)

## Current Implementation Status

As of 2026-07-03:
- ✅ tastile-core API integration for tile CRUD and execution state
- ✅ `Tile` domain model, command/event types, validator, reducer, and `CommandHandler` are present under `src/lib/domain` and `src/lib/core`
- ✅ `use-execution-engine.ts` delegates to tastile-core API
- ✅ `/dashboard` routes consume derived execution state through the execution engine context and dashboard projection
- ⚠️ The implementation still has architecture drift from v1 spec in places, especially around independent `Execution` snapshots and quota/auth hardening
- ⚠️ Some dashboard and storage behavior still depends on compatibility projections rather than a fully v1-aligned model

### What Still Needs Work

To move from "working branch" to "spec-aligned release candidate", focus on:
1. v1 Tile ドメインモデルの実装 - see tastile-core/v1/02-core-entities.md
2. Tightening API quota/auth behavior so runtime guarantees match the repo docs
3. Removing remaining compatibility shortcuts in projection and storage code
4. Expanding tests around dashboard execution flows, prompt behavior, and migrations

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

Required in `.env.dev` (development) or `.env.product` (production):
```dotenv
NEXT_PUBLIC_TASTILE_CORE_URL=http://localhost:3140
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

See `.env.dev.example` or `.env.product.example` for reference.
