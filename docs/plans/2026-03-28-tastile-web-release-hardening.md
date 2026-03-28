# Tastile Web Release Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `tastile-web` を、設計文書と整合した最小限の本番投入可能状態まで引き上げる。

**Architecture:** まず Core の真実をドキュメント準拠に寄せ、`Command -> Validation -> Event -> Reducer` の流れを Web 実装内で一貫させる。次に Supabase/Auth/Projection/UI の接続点を実データ前提に整理し、最後に出荷ゲートとして E2E と運用設定を揃える。

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, Playwright, Tailwind v4, tastile-core WASM

---

## Current Findings

- `src/lib/core/state.ts` が `Execution` を独立オブジェクトとして保持しており、`03_Domain_Model_and_Tile_Conditions.md` の「タイル集合が唯一の真実」と衝突している。
- `src/lib/core/command.ts` / `src/lib/core/event.ts` / `src/lib/core/handler.ts` が `complete_tile` や `delete_tile` など、設計書にない command/event 名と責務を持っている。
- `src/lib/projection/dashboard-projection.ts` と `/dashboard/*` UI が簡易 lifecycle と timeline に依存しており、条件ベクトル起点の導出にまだ寄っていない。
- `src/lib/storage/tile-repository.ts` は `tiles` テーブルの JSON 条件列を読んでおらず、Tile 条件モデルをほぼ捨てている。
- `src/lib/supabase/env.ts` は `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を必須にしているが、AGENTS.md は `NEXT_PUBLIC_SUPABASE_ANON_KEY` を要求しており、運用手順が分裂している。
- `README.md` は create-next-app の雛形ベースで、現アーキテクチャ・運用手順・本番チェック項目を反映していない。

## Release Definition

本計画でいう「release-ready」は次を満たす状態とする。

1. Core の read/write モデルが AGENTS.md と設計文書に明確に整合している。
2. `/dashboard` が mock 前提ではなく、Supabase または WASM/daemon snapshot から導出した状態で動く。
3. 認証、イベント読込、主要操作（開始・完了・先送り・休憩）が最低限の自動テストで守られている。
4. `.env`、README、ビルド、デプロイ前チェックが人間に引き継げる粒度で整備されている。

### Task 1: Freeze The Target Model

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\domain\tile.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\domain\execution.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\state.ts`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\command.test.ts`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\prompt-parity.test.ts`

**Step 1: Write failing tests for the target state shape**

- Add tests that assert:
  - Tile lifecycle is derived only from `startedAt` / `completedAt`
  - `AppState` does not need a source-of-truth `activeTileId`
  - prompt derivation can be computed from tile collections and open segments

**Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- --run src/lib/core/command.test.ts src/lib/core/prompt-parity.test.ts`

**Step 3: Remove model drift**

- Delete unsupported fields such as recurrence-only shortcuts that are not in the v1 spec unless already justified by docs.
- Convert `Execution` to a derived snapshot type, not a persisted truth holder.
- Keep only tile facts and event history as state truth.

**Step 4: Re-run the focused tests**

Run: `npm test -- --run src/lib/core/command.test.ts src/lib/core/prompt-parity.test.ts`

**Step 5: Commit**

```bash
git add src/lib/domain/tile.ts src/lib/domain/execution.ts src/lib/core/state.ts src/lib/core/command.test.ts src/lib/core/prompt-parity.test.ts
git commit -m "refactor: align app state with tile-truth model"
```

### Task 2: Rebuild Command/Event/Reducer Around The Spec

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\command.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\event.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\validate.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\handler.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\reducer\index.ts`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\core\handler.test.ts`

**Step 1: Add failing tests for canonical command flows**

- Cover `CreateTile`, `StartTile`, `CompleteAndStartNext`, `DeferTile`, `StartBreak`, `EndBreak`, `AttachMemo`, `ReevaluatePrompt`.
- Assert multi-event atomic flows instead of one-command-one-event shortcuts.

**Step 2: Run the handler tests and confirm failures**

Run: `npm test -- --run src/lib/core/handler.test.ts`

**Step 3: Replace ad-hoc commands/events**

- Rename/remove non-spec names where they are domain drift.
- Make validation own acceptance rules.
- Make reducer pure and deterministic over event lists.
- Preserve request id propagation for idempotency.

**Step 4: Re-run the handler tests**

Run: `npm test -- --run src/lib/core/handler.test.ts`

**Step 5: Commit**

```bash
git add src/lib/core/command.ts src/lib/core/event.ts src/lib/core/validate.ts src/lib/core/handler.ts src/lib/core/reducer/index.ts src/lib/core/handler.test.ts
git commit -m "refactor: rebuild command event reducer pipeline"
```

### Task 3: Make Storage Honor Tile Conditions And Event Ordering

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\storage\event-store.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\storage\tile-repository.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\supabase\migrations\20260317000001_free_tile_limit_100.sql`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\storage\event-store.test.ts`

**Step 1: Add failing storage tests**

- Assert event deserialization keeps command/event timestamps stable.
- Assert tile repository rehydrates all condition vectors from JSON columns.
- Assert sequence ordering does not depend on `Date.now()` collisions.

**Step 2: Run storage tests and confirm failures**

Run: `npm test -- --run src/lib/storage/event-store.test.ts`

**Step 3: Fix persistence model**

- Map `temporal_conditions`, `objective_conditions`, `interruption_conditions`, `automation_conditions`, `annotation_conditions` into `Tile`.
- Stop approximating `sequence_number` with wall-clock milliseconds if a stricter ordering source is needed.
- Normalize old/new payload columns without silently dropping unsupported events.

**Step 4: Re-run storage tests**

Run: `npm test -- --run src/lib/storage/event-store.test.ts`

**Step 5: Commit**

```bash
git add src/lib/storage/event-store.ts src/lib/storage/tile-repository.ts supabase/migrations/20260317000001_free_tile_limit_100.sql src/lib/storage/event-store.test.ts
git commit -m "fix: align storage with tile conditions and event ordering"
```

### Task 4: Reconnect Dashboard To Real Derived State

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\hooks\use-daemon-execution.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\hooks\use-execution-engine.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\projection\dashboard-projection.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\dashboard\execute\page.tsx`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\dashboard\tiles\page.tsx`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\dashboard\history\page.tsx`
- Remove or isolate: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\mock-data.ts`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\dashboard\history\page.test.tsx`

**Step 1: Add failing UI/projection tests**

- Assert dashboard pages render derived next tile, active execution, history, and timeline from real `AppState`.
- Assert no page imports `mock-data` for dashboard behavior.

**Step 2: Run targeted UI tests**

Run: `npm test -- --run src/app/dashboard/history/page.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx`

**Step 3: Refactor projection + pages**

- Derive dashboard sections from canonical state only.
- Remove assumptions that there is exactly one persisted active tile truth.
- Keep `/dashboard` as the main surface; do not expand `/app` work except where shared components require it.

**Step 4: Re-run targeted UI tests**

Run: `npm test -- --run src/app/dashboard/history/page.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx`

**Step 5: Commit**

```bash
git add src/lib/hooks/use-daemon-execution.ts src/lib/hooks/use-execution-engine.ts src/lib/projection/dashboard-projection.ts src/app/dashboard/execute/page.tsx src/app/dashboard/tiles/page.tsx src/app/dashboard/history/page.tsx src/app/dashboard/history/page.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx src/lib/mock-data.ts
git commit -m "feat: connect dashboard to derived execution state"
```

### Task 5: Normalize Auth And Environment For Production

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\supabase\env.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\supabase\client.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\supabase\server.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\auth\callback\route.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\.env.local.example`
- Test: `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\supabase\env.test.ts`

**Step 1: Add failing env tests**

- Assert the app accepts the one true public key env name decided for this repo.
- Assert missing env errors explain exactly which variable is absent.

**Step 2: Run env tests**

Run: `npm test -- --run src/lib/supabase/env.test.ts`

**Step 3: Remove configuration drift**

- Choose either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and use it consistently across docs, runtime, and deploy env.
- Verify auth callback uses the same source.
- Ensure browser/server clients share the same env contract.

**Step 4: Re-run env tests**

Run: `npm test -- --run src/lib/supabase/env.test.ts`

**Step 5: Commit**

```bash
git add src/lib/supabase/env.ts src/lib/supabase/client.ts src/lib/supabase/server.ts src/app/auth/callback/route.ts .env.local.example src/lib/supabase/env.test.ts
git commit -m "fix: normalize supabase auth environment contract"
```

### Task 6: Add A Real Release Gate

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\playwright.config.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\e2e\*`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\package.json`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\README.md`

**Step 1: Add failing E2E coverage**

- Create Playwright coverage for:
  - login redirect behavior
  - dashboard load for authenticated user
  - start/complete/defer happy path against the chosen execution backend

**Step 2: Run the E2E suite and capture failures**

Run: `npm run test:e2e`

**Step 3: Fix runtime/setup gaps**

- Add test fixtures, auth bootstrap, and deterministic seed data.
- Update package scripts if release checks need a dedicated `test:release` pipeline.
- Rewrite README to describe architecture, env setup, local development, release checklist, and known limits.

**Step 4: Run full release gate**

Run:

```bash
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

**Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json README.md
git commit -m "chore: add release gate and deployment docs"
```

## Final Verification Checklist

- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `npm run test:e2e`
- Manual verification:
  - Google login round-trip works in preview/prod env
  - `/dashboard/execute` can start, defer, complete, and end break
  - Supabase `events` rows append with stable ordering and correct actor fields
  - no `/dashboard` route depends on `src/lib/mock-data.ts`

## Notes For Execution

- The worktree is already dirty. Do not revert unrelated user edits.
- Prefer small, reviewable commits after each task.
- If the daemon/WASM dual-backend model keeps conflicting with the document model, bias toward one canonical backend for release and explicitly downgrade the other to experimental.
