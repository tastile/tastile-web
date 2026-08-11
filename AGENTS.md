# AGENTS.md

> **薄い dispatcher**。Repository-local contract。正本は `../AGENTS.md`（workspace 全体）、
> `../docs/HARNESS.md`（方針）、`../tastile-core/v1/`（domain & API）。この file は web
> layer 固有の command / directory / 進行中事実にだけ責任を持つ。
>
> `CLAUDE.md` は同等の thin adapter（Claude Code 用）。Codex / Cursor 等はここを読む。

## 必ず先に読む正本

| 内容 | 場所 |
| --- | --- |
| workspace 全体契約（cross-repo / 並列化 / commit / Python 禁止 / Bun 固定） | `../AGENTS.md` |
| 全体方針・認証・インフラ | `../docs/HARNESS.md`、`../docs/decisions.md` |
| domain・schema・不変条件・API | `../tastile-core/v1/02-core-entities.md`、`.../v1/10-invariants.md`、`.../v1/14-read-model-and-endpoint.md` |
| v1 仕様正本（旧 pomodoroom/CORE_POLICY.md、tastile_docs_bundle/ は廃止） | `../tastile-core/v1/` 配下 15 ファイル |
| Claude Code 設定・skills 関係 | `CLAUDE.md`（同内容） |

これら 4 系列を読み終えるまで実装判断しない。

## Repository facts（repo-local のみ）

- **役割**: `tastile-core` API の thin client。business logic は持たない。Windows primary は `tastile-desktop`。
- **Stack**: Bun 1.3.x / Next.js 16 (App Router) / React 19 / TypeScript 5 / Tailwind v4 /
  Mantine v9 / Zod / Zustand / TanStack Query / Vitest 4 / Playwright 1.62 / Knip 6 /
  Biome 1.9（biome linter/formatter off、ESLint 9 が lint） / ripgrep。
- **Backend**: AWS 上の `tastile-core`（Rust/axum）。PostgreSQL 直接接続禁止。
- **Auth**: AWS Cognito Hosted UI（Google OAuth + Sign in with Apple）。Bridge secret は
  `TASTILE_WEB_BRIDGE_SECRET`、`scripts/wslc/up.sh` の既定値と `.env.development` を揃えろ。
- **Sync**: poll + SSE。`active_tile` / `phase` 等の browser-local execution state は cloud に保存しない。
- **Route structure**: `/` (landing)、`/dashboard/*` (main UI)、`/app/*` → `/dashboard` へ permanent redirect
  (`next.config.ts`)、`/api/*` (Stripe, OpenAPI, proxy 等)。dashboard 機能追加は `/dashboard` へ。
- **Directory layout (Feature-Sliced Design)**: `src/app/`（routes, api）、`src/shared/`（cross-cutting）、
  `src/features/`（create-tile, execute-tile, manage-*, marketing, view-notifications）、
  `src/widgets/`（app-shell, activity-bar, floating-header, side-tool-panel）、
  `src/views/`（dashboard）、`src/{tile,execution,calendar}/`（domain slice）、
  `src/lib/`（legacy 非 FSD: account / api / billing / notifications / projection / scheduler / security /
  styles / theme / upstream / vendored）。旧 `src/lib/{domain,core,storage,hooks}` 形は FSD 化により deprecated。
- **`src/lib/vendored/mantine-schedule`**: vendor copy（npm 取得なし）。Knip ガード対象。
  触らない（編集時は upstream PR or ADR 必須）。
- **Container**: `Containerfile`（Dockerfile ではない）、`oven/bun:1.3.14` build →
  `node:20-bookworm-slim` run、`output: "standalone"`。

## Repository invariants（repo-local、不変条件）

- **Facts, Not States**: `status` / `running` / `active` は stored field ではなく derived。
  Command → Validation → Event → Store → Reducer → AppState の経路のみで state 更新。
- **Events are facts**（TileStarted, TileCompleted 等）。UI action (`ClickedButton`) は event ではない。
- **No `kind` 文字列 enum**: v1 は数値定数のみ。
- **No `_old/` 編集**: deprecated archive。触らない。
- **No derived state field** を storage に置かない。
- **CLI-First**: 全 business logic は Command API 経由。AI 用 backdoor API を作らない。
- **No business logic in client**: domain は `tastile-core` のみが所有。
- **No policy §10 violation**: 新規 Python script は作らない（本日 2026-08-12 に `scripts/*.py`
  debug helper 6 件が残存していたが削除済み）。
- **`src/lib/test`** （mock-pool / setupTestPoolFromEnv）の名前は責務不明瞭 → `src/shared/testing/` か
  `src/test-utils/` への rename を将来 ADR で扱う。現状は maintenance 内のみ。

## Canonical commands（`package.json` 由来・変更禁止）

| 用途 | command |
| --- | --- |
| dev server | `bun dev` |
| production build | `bun run build` |
| product artifact | `bun run build:prod` |
| biome check | `bun run lint:biome` |
| eslint | `bun run lint` |
| typecheck | `bun run typecheck` |
| knip | `bun run knip` |
| vitest unit | `bun run test:unit` |
| vitest single | `bun test path/to/file.test.ts` |
| playwright e2e | `bun run test:e2e` |
| openapi regen | `bun run generate-types` |
| react-doctor | `bun run doctor` |
| **standard gate** | `bun run check` = `lint:biome && lint && typecheck && knip && test:unit` |
| **release gate** | `bun run check:release` = check + bun audit + `build:prod` |

完成基準は `bun run check` を **0 error / 0 actionable warning / 0 unjustified suppression** で通すこと。
`bun audit` の 4 ignore（`GHSA-qx2v-qp2m-jg93`、`GHSA-6g55-p6wh-862q`、`GHSA-r28c-9q8g-f849`、
`GHSA-f88m-g3jw-g9cj`）は記録済みで変更禁止。E2E touch 時は必ず Playwright を走らせる。
UI 変更は実 browser screenshot を `.tmp/` に残して判定。

## Repository configuration hotspots（要 attention）

- **`eslint.config.mts` ignores**: `**/src/test/**`, `**/src/shared/**`, `**/src/views/**`,
  `**/src/widgets/**`, `**/src/features/**`, `**/e2e/**`, `**/scripts/**`, `**/src/components/**`（dead、
  FSD 移行完了につき削除候補）。これらは production source directory を丸ごと ignore。**新規 ESLint
  error を握りつぶす口にはしない。** もし ignore を増やしたい場合は別 ADR で扱う。
- **`biome.json`**: `formatter.enabled: false` / `linter.enabled: false`。`bun run lint:biome` は
  `biome check .`（構文 & JSON 検証のみ）。実 lint は ESLint。
- **`knip.json`**: `project: ["src/**"]`、`ignore: ["src/lib/vendored/**"]`、
  `ignoreBinaries: ["wslc"]`。
- **`vitest.config.ts`**: `envDir: false`、`E2E_BYPASS_AUTH=""` を **意図的に空上書き** で `.env.local`
  の auth bypass を無効化（コメント内説明あり）。`--localstorage-file=…` で Node の experimental
  warning を source 解決（境界で filter しない）。
- **`playwright.config.ts`**: `webServer.env` ブロックがインデント崩れている既存形（commit
  `ecb4afc3` で audit issue #96 由来の `TASTILE_WEB_BRIDGE_SECRET` 追加）。`env` 内に収めるのが本来形。
- **`.gitignore`**: `.tmp/`、`.reference/`、`evidence/*.{log,network-response}`、
  `openapi.json`、`.openapi-cache.json`、`dev-server.{log,pid}`、`docs/plans/evidence/**/screenshots/`
  等が ignore 対象（policy §30/§31 準拠）。

## Environment & secrets

- 必要 env schema は `.env.development.example` / `.env.production.example` を source of truth。
- 実値保持可: `.env`、`.env.development`、`.env.production`（**全部** gitignore）。**`.env.local`、
  `.env.test` 等は禁止**。
- secret は example に空欄で、`PUBLIC_VALUE=safe-example` の形で書く。実 token を example に入れない。
- `.env.local` に書くつもりだった値は、Vitest config のコメントが解説するように component test で
  auth が short-circuit するため **書かない**。CLOUD_API_BASE / TASTILE_RUST_API_URL を `.env.development`
  に置く。

## Skill list（`.agents/skills/`、`../AGENTS.md` 経由で activate）

- `react-doctor` — UI 規約違反検出。
- `tastile-precommit-review` — agent-initiated commit 直前の独立 review（self-approve 禁止、
  Codex ↔ Claude 別 agent で実行）。
- workspace 共通: `cross-repo-contract-check`（複数 child に跨る contract 変更）、
  `verify-tastile-change`（commit / merge / ship の直前に実行）。

## Pitfalls（実測ベースの罠）

- **`workspace snapshot` は stale**: session 開始時に shell の cwd が `C:\Users\rebui\work\` 配下を
  指すが、実作業 tree は `C:\Users\rebui\Desktop\tastile\tastile-web\`。**`git status` を毎回実 tree で
  取り直せ**。
- **`scripts/*.py` の再発防止**: ESLint ignore に `**/scripts/**` が入っているため `.py` を lint で
  検出できない。code review gate と pre-commit reviewer が最後の砦。
- **`src/lib/components/` 名の罠**: `eslint.config.mts` ignores に `**/src/components/**` があるが
  `src/components/` ディレクトリは実在しない（FSD 移行完了）。dead entry として整理対象。
- **policy §11 violations（i18n hardcoded literal）**: `src/features/create-tile/ui/**` および
  `src/execution/model/**`、`src/shared/stores/quick-create-store.ts` の doc-comment に日本語 hardcoded
  literal が点在。i18n bundle（`src/shared/i18n/sections/**/*.ts`）は正しくできているので、JSX literal は
  i18n 経由に統一すべき。次のスコープ大きい refactor 候補として ADR 記録予定。
- **`bun run test <path>` の罠**: 旧 AGENTS.md で `bun test src/lib/storage/event-store.test.ts` と
  書かれていたが、`src/lib/storage/` ディレクトリは FSD 移行で消滅。実体は `src/shared/...` 配下。
  `bun test path` または `bun run test:unit` 経由が安全。
- **`patch` tool の Windows lint 偽陰性**: `patch` 後 `lint: file /c/Users/... does not exist` を
  返すことがあっても、`resolved_path` / `files_modified` で書き込み成功を確認可能。lint 偽陰性。
  再書き込み禁止（二重書き込み）。
- **`auto-prepended nextjs-agent-rules`**: `next dev` が AGENTS.md 末尾に
  `BEGIN/END:nextjs-agent-rules` ブロックを自動再注入。committed block は残す。diff 内で一度消しても
  `next dev` 起動で復活する。

## Implementation status (snapshot 2026-08-12)

- ✅ `tastile-core` API client + FSD 移行完了、`EventStore`、`use-execution-engine`、`/dashboard` shell。
- ✅ v1 Tile ドメインモデル・Command/Event/Validator/Reducer/CommandHandler 実装済み（`src/lib/domain`、
  `src/lib/core`、`src/tile/model/v1`）。
- ⚠️ v1 architecture drift が部分残存（independent `Execution` snapshots / quota / auth hardening）。
- ⚠️ `src/features/create-tile/**` の i18n hardcoded literal が policy §11 違反。別 ADR / refactor。

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
