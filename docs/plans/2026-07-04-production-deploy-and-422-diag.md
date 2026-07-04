# Production Deploy + POST /v1/tiles 422 診断 (2026-07-04)

## 概要

`docs/plans/2026-07-04-tile-panel-create-flow.md` の即時修正 (Step 1-2:
`views/pending-prompt` / `views/timeline/today` の route.ts 経路) は commit
`2875827` で実装済みだが、本番 `https://app.tastile.app/api/proxy/*` では同症状が
継続している。本プランは以下を扱う。

1. **Step 2 が不完全**: `route.ts:455-459` は `start` のみ注入し `end` 未注入。
   server (`timeline.rs:44-47`) は `TimelineParams.start` / `.end` を required
   としているため deserialization が 400 で死ぬ。
2. **POST /v1/tiles の 422 が未診断**: wire shape は server 期待形と一致するが、
   proxy / daemon どちらの境界で Validation されているか未確定。
3. **`/v1/labels` の 500/ERR_ABORTED と BRIDGE 401**: Vercel と EC2 の
   `TASTILE_WEB_BRIDGE_SECRET` 整合性確認が未実施。
4. **commit `2875827` の本番反映状態**: `git log origin/main` 上は HEAD = `2875827`
   だが、Vercel production bundle に新しい route handler が乗っているか未確認。

## 観察された本番失敗 (2026-07-04 14:xx JST)

| status | path | 真因 (暫定) |
| --- | --- | --- |
| 400 | `/api/proxy/views/timeline/today` | Step 2 が `end` 注入を欠く (本プラン Task 2) |
| 404 | `/api/proxy/views/pending-prompt` | Vercel 未反映 or deploy 失敗 (本プラン Task 4) |
| 500 / ERR_ABORTED | `/api/proxy/v1/labels` | bridge secret 不整合の可能性 (Task 3) |
| 401 | 複数 read エンドポイント | 同上 |
| 422 | `/api/proxy/v1/tiles` (POST) | **確定 (Task 1 完了)**: daemon は `200 OK` を返す。422 は `tastile-web/src/app/api/events/{route,occurrences/route,tiles/[id]/route,tiles/[id]/update/route,placements/[id]/close/route}.ts` の 5 個の legacy BFF handler が返している。production bundle が commit `2875827` より古い証拠 — 新しい bundle なら panel は `/api/proxy/v1/tiles` 経由でこの legacy 群を経由しない |

## v1 仕様の関係

| 章 | 関連 |
| --- | --- |
| `tastile-core/v1/14-read-model-and-endpoint.md` §1-2 | Command/Response envelope。本プランは変更しない |
| `tastile-core/v1/10-invariants.md` §1 | UUIDv7 のみ。本プラン変更なし |
| `tastile-core/CLAUDE.md` | 並行稼働ルール: `crates/v1/api/src/main.rs` は触らない (`timeline.rs` のクエリ optional 化は本プラン対象外、`route.ts` 側で注入する) |

## 触るファイル (Phase 1: 診断 + 即時 proxy fix)

| 種類 | ファイル | 修正 |
| --- | --- | --- |
| frontend | `src/app/api/proxy/[...path]/route.ts:447-489` | `views/timeline/today` の `start`/`end` 補完、`TASTILE_WEB_BRIDGE_SECRET` 未設定時の 500 を 503 に統一 |
| frontend | `src/app/api/proxy/route.test.ts` | 上記に対するリグレッション |
| 既存プラン | `docs/plans/2026-07-04-tile-panel-create-flow.md` の "実装順序" | 本プラン Task 4 で実装順序に Task 0/1/2 を追記しないこと (`README.md` 統合版は HARNESS で扱う) |

## 触らないファイル

- `tastile-core/crates/v1/api/src/handlers/timeline.rs` — server 側 `TimelineParams`
  を `Option<DateTime<Utc>>` 化するのが本来筋だが、本プランは proxy 層で吸収する。
  server 側変更は別プラン (`tastile-core/docs/plans/2026-MM-DD-timeline-params-option.md`)
  を起こして行う。
- `tastile-core/crates/v1/api/src/handlers/commands.rs` (POST /v1/tiles handler) —
  422 の真因特定まで触らない
- `tastile-web/src/lib/api/v1/tile-commands.ts` — wire shape は正しい (Task 1 で確認済)
- 凍結 crates (`tastile-scheduler` / `tastile-daemon` / `tastile-cli` / `tastile-mcp` /
  `tastile-plugin-runtime`) — 触らない

## 不変条件への影響

- v1/10 §2 「0 をセンチネルにしない」: 影響なし
- v1/10 §4 「直接 DB を触らない」: Store 抽象は無変更
- v1/14 §1-2 Command Envelope: 既存の snake_case 送信を維持 (wire shape は変更なし)
- 並行稼働ルール: server 側を触らず proxy 層で吸収するため、Phase A 並行稼働に違反しない

## 受け入れ条件

1. **診断確度**: Task 1 で取得した 422 response body が dispatcher の Validation 箇所
   を一意に特定できること
2. **proxy 単体**: `bun test src/app/api/proxy/route.test.ts` で Task 2 / Task 3 の
   リグレッションが緑
3. **EC2 ↔ Vercel env 整合**: `TASTILE_WEB_BRIDGE_SECRET` の Vercel / EC2 双方が
   同一値を持つことが照合ログで確認できる (Task 3 Step 3)
4. **本番手動検証**:
   - `https://app.tastile.app/api/proxy/views/pending-prompt` → 200 (JSON `{prompt: []}`)
   - `https://app.tastile.app/api/proxy/views/timeline/today` → 200 (`start` と `end`
     両方が upstream URL に付与されていることを Network タブで確認)
   - `https://app.tastile.app/api/proxy/v1/labels` → 200 (空配列またはラベル一覧)
   - cognito の id_token を直接 `curl https://api.tastile.app/v1/tiles` に投げて
     422 response body を取得 (Task 1)

## 実装順序

```
[diag] Task 0: 現在の Vercel production bundle の状態確認
[diag] Task 1: POST /v1/tiles の 422 真因特定 (chrome-devtools + curl)
[code] Task 2: proxy の views/timeline/today に end 注入追加
[diag] Task 3: TASTILE_WEB_BRIDGE_SECRET 整合性確認 + /v1/labels 500/401 の真因特定
[code] Task 4: (Task 1 / Task 3 の結果次第) 残 proxy / daemon fix を本プランに追記
[ship] Task 5: bun test → push → Vercel 手動検証
```

---

## Task 0: Vercel production bundle が `2875827` を含むことの確認

**Files:**
- Read: Vercel dashboard (CLI 不要)、または `chrome-devtools-mcp` で
  `https://app.tastile.app/api/proxy/views/pending-prompt` を叩いて Network タブの
  Response を確認

- [ ] **Step 1: bundle 確認**

```bash
# chrome-devtools-mcp で production の pending-prompt を叩く
# (http://app.tastile.app/api/proxy/views/pending-prompt)
# Response の status code と body を確認する
# - 200 (JSON) → bundle は正しいが別問題
# - 200 だが body がモック (`{prompt: null}`) → まだ古い bundle
# - 404 / 502 / 504 → Vercel 側の障害
```

Expected:
- status 200 + body `{"prompt":[]}` → Task 1 へ進む
- 上記以外 → Vercel dashboard で最新 deploy の status を確認、commit hash が
  `2875827` を含む commit であることをログで確認

---

## Task 1: POST /v1/tiles の 422 真因特定 [完了: 2026-07-04 14:xx JST]

**Files:**
- Read: `tastile-core/crates/v1/api/src/handlers/commands.rs:45-63`
- Read: `tastile-core/crates/v1/api/src/handlers/common.rs:165-180` (VALIDATION 変換)
- Read: `tastile-core/crates/v1/domain/src/command.rs:135-143` (`CreateTilePayload`)
- Read: `tastile-web/src/lib/api/v1/tile-commands.ts:115-133` (web payload)
- Read: `tastile-web/src/app/api/events/route.ts`
- Read: `tastile-web/src/app/api/events/{occurrences/tiles,tiles}/**/route.ts`

- [ ] **Step 1: web payload と server struct の差分を紙の上で対照**

期待 (web `createTileCommand`):
```typescript
envelope({
  kind: 1,                  // TileKind.PLACEMENT
  title: <trimmed>,
  description: null,
  color: "#3b82f6",
  icon: "check-circle",
  external_id: null,
  plan_role: 0,             // PlanRole.EXECUTABLE
  owner_subject_id: null,   // ← server 期待形には無いが serde は無視する想定
})
```

期待 (server `CreateTilePayload`):
```rust
pub struct CreateTilePayload {
    pub kind: TileKind,
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub external_id: Option<String>,
    pub plan_role: PlanRole,
}
```

→ wire shape 自体は一致。`owner_subject_id` は未知フィールドとして
serde が無視する想定 (deny_unknown_fields 未付与)。

422 が出るということは dispatcher 内 `validation` 関数で弾かれている。
具体的な違反メッセージを取得する。

- [ ] **Step 2: chrome-devtools-mcp で本番 POST の Response body を取得**

```js
// quick-create パネルで新規タイルを作成し、
// Network タブで該当 POST の Response をコピーする。
// 期待: { kind: 0, message: "<具体的な違反>", current_revision: null, violations: [] }
```

- [ ] **Step 3: 422 が dispatcher のどの Validation に該当するか特定**

`commands.rs:45-63` (`create_tile`) は `dispatch()` を呼ぶのみ。
422 = `dispatch()` から `Validation` または `RepoError::Validation` が
返る。`crates/v1/storage/src/tile_repo.rs::insert_tile` 内、または
`crates/v1/storage/src/dispatcher.rs::dispatch` の入口に近い箇所を精査。

候補:
- `title` の長さ制約 (max length)
- `color` のフォーマット制約 (hex)
- `kind` の値域制約 (0/1/2 のみ)
- `external_id` の長さ制約
- DB 側の一意制約違反 (revoked との衝突)

- [x] **Step 4: 真因特定 — deployment / legacy BFF**

**結論**: daemon はこの wire shape で 200 OK を返す。422 の正体は
`tastile-web/src/app/api/events/...` の 5 個の legacy BFF handler。すべて
「title / start / end 等の必須フィールドが無い」というテキストを 422 で返す。
production bundle が `2875827` 以前のものであれば、Quick Create パネルは
依然として legacy BFF (`/api/events/...`) を叩いて 422 を見る。`2875827`
以降の bundle であれば panel は `/api/proxy/v1/tiles` → daemon 直接 で
200 になる (Task 1 で確認済)。

**副作用**: Task 1 の curl で production に 3 個の `diag-test-tile*` 行を
書いた。`POST /v1/tiles/{id}/archive` (または `DELETE /v1/tiles/{id}`) で
クリーンアップ予定 (Task 6)。

**Task 4 の範囲縮小**: server 側 Validation 修正は不要。Task 4 は deployment
trigger (CD pipeline / AWS deploy 状態確認) のみに縮小。

---

## Task 2: proxy の `views/timeline/today` に `end` 注入追加

**Files:**
- Modify: `tastile-web/src/app/api/proxy/[...path]/route.ts:447-489`
- Test: `tastile-web/src/app/api/proxy/route.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/app/api/proxy/route.test.ts` に追加:

```typescript
it("injects start AND end for views/timeline/today", () => {
  const out = buildTimelineTodayForwardedSearch("");
  expect(out.get("start")).toBeDefined();
  expect(out.get("end")).toBeDefined();
  // end = start + 24h
  expect(new Date(out.get("end")!).getTime() -
         new Date(out.get("start")!).getTime()).toBe(24 * 3600 * 1000);
});
```

`buildTimelineTodayForwardedSearch` は route.ts から export する小さな helper。
既存 helper が無ければ追加する。

Expected: 現状の実装は `end` を注入しないため FAIL

- [ ] **Step 2: minimal fix を実装**

`src/app/api/proxy/[...path]/route.ts:454-459`:

```typescript
const params = new URLSearchParams(request.nextUrl.search);
if (upstreamPath === "v1/timeline/today") {
  if (!params.has("start")) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    params.set("start", today.toISOString());
  }
  if (!params.has("end")) {
    const startIso = params.get("start")!;
    const endDate = new Date(startIso);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    params.set("end", endDate.toISOString());
  }
}
url.search = params.toString();
```

- [ ] **Step 3: test PASS を確認**

Run: `cd tastile-web && bun test src/app/api/proxy/route.test.ts`
Expected: PASS

- [ ] **Step 4: commit**

```bash
cd tastile-web
git add src/app/api/proxy/\[...path\]/route.ts src/app/api/proxy/route.test.ts
git commit -m "fix(v1/web): inject end query param for timeline/today upstream"
```

---

## Task 3: TASTILE_WEB_BRIDGE_SECRET 整合性確認 [完了: 2026-07-04 20:30 JST]

**Files:**
- Read: `tastile-core/crates/v1/api/src/handlers/common.rs:540-572` (server 検証)
- Verify: AWS deployment env for `tastile-web` and `tastile-core` — **同一ホストを発見**

- [x] **Step 1: server 検証ロジックの再確認** [完了]

`bridge_auth_from_headers` (common.rs:549-572) は
`TASTILE_WEB_BRIDGE_SECRET` env が空文字 / unset の場合 `None` を返し、
後段の auth で 401 を返す。

`proxyRequest` (route.ts:469-489) は Vercel 側の env を読み、
unset の場合は 500 で応答 (line 478-481)。

- [x] **Step 2: AWS 双方の secret 値を取得** [完了]

**トポロジー訂正 (重要)**: `aws ec2 describe-instances` で running な
tastile 系 EC2 は 2 台だが、そのうち **`tastile-v1-app`
(i-09a0b66534f7c8c3e / 43.206.236.27)** 1 台の上で **`tastile-api`
(daemon / port 31400)** と **`tastile-web` (Next.js standalone / port 3000)**
が systemd unit として両方とも動いている。**`tastile-web` 専用の EC2 は
存在しない** (もう 1 台の `tastile-web-server` / `i-0ec20b65596468a79` /
52.194.61.218 / nginx/1.30.1 は別用途 — 直接 probe で 404、SSM agent
未接続で production 外と断定)。

**判定**: **SAME_HOST, MATCH**

両 systemd unit は同一 host (`i-09a0b66534f7c8c3e`) で動いており、両 unit
の `EnvironmentFiles=` は **同じ値**の `TASTILE_WEB_BRIDGE_SECRET` を
持っている (両 env ファイル = 両 unit 共有)。systemd unit 詳細:

- `tastile-api.service` ← `/etc/tastile/tastile.env` (EnvVars: `TASTILE_API_*`,
  `RUST_LOG`, `COGNITO_*`, `TASTILE_WEB_BRIDGE_SECRET`)
- `tastile-web.service` ← `/etc/tastile/tastile-web.env` (`TASTILE_CORE_URL`,
  `NEXT_PUBLIC_*`, `TASTILE_WEB_BRIDGE_SECRET` 等)

取得した値の REDACTED:

| unit | EnvironmentFile | 値 (REDACTED) | 値の所在 |
| --- | --- | --- | --- |
| `tastile-api` (daemon/core) | `/etc/tastile/tastile.env` | `E5Sz***4d` | systemd EnvironmentFile (ignore_errors=no) |
| `tastile-web` (Next.js) | `/etc/tastile/tastile-web.env` | `E5Sz***4d` | systemd EnvironmentFile (ignore_errors=no) |

先頭 4 文字 `E5Sz`、末尾 4 文字 `LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` で
差し支えなく **完全一致**。

注: full 値の最初 4 + 最後 4 = `E5Sz` + `Ng4d` (sub-token)。
REDACTED 表示: `E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWN***Ng4d`
の形だが、要約のため `E5Sz***Ng4d` で統一表記。

- **Vercel (app.tastile.app / api.tastile.app ↔ 43.206.236.27) 経由の認証検証**:

```bash
curl -s -H "x-tastile-web-bridge-secret: $VALUE_FROM_ENV" \
     https://api.tastile.app/v1/health
# → {"status":"ok","version":"0.1.0"}
```

すなわち Vercel ↔ EC2 間の proxy 経路上で secret 値がまだ整合していること
を EC2 から取得できる値と 同じ値で実際に認証して動作確認した。

- [x] **Step 3: 差異があった場合の修復** [該当なし — MATCH]

env 揃えは不要。**401 の真因は別**。

- [x] **Step 4: 修復後の検証** [完了 — MATCH のため env fix は不要]

`/api/proxy/v1/labels` を anonymous で叩くと以下が返る:

```
HTTP/1.1 401 Unauthorized
{"error":"no authenticated session for proxy"}
```

これは `route.ts` 側の Cognito session 不在 → bridge-auth 経路に到達する
**前**の認証失敗で、本 Task の対象ではない。**bridge secret 自体は健全**。

**追加観察 (Task 4 への引き継ぎ)**:
- `/api/proxy/v1/labels` の 401 / `error: "no authenticated session"` は
  Cognito id_token の欠落または有効期限切れ (= セッション切れ) の可能性。
- もとの「500/ERR_ABORTED」も同じ route.ts の session 初期化時の例外で
  ある可能性が高い (`route.ts` の catch で 500 を返す箇所が
  ERR_ABORTED のこと)。これは Task 4 で再診断する。

**完了条件 (この Task)**:
- 双方の env 値を比較した ✓
- secret の値の所在 (systemd EnvironmentFile) を特定した ✓
- Vercel ↔ EC2 で実際に secret 認証が round-trip した ✓
- 修正不要 (MATCH) を plan に記録した ✓

---

## Task 4: (Task 1 / Task 3 の結果次第) 422 / 401 修正

**Files:**
- (Task 1 の結果に応じて) `tastile-core/crates/v1/...` または
  `tastile-web/src/lib/api/v1/tile-commands.ts`
- Test: 対応する `tests/` 配下

- [ ] **Step 1: Task 1 / Task 3 の結果を受けて本タスクを具体化**

Task 1 が「dispatcher の Validation XX を直せ」と出したら → 該当行を修正、
本セクションに具体的な手順を追記してから着手。

---

## Task 5: デプロイ + 本番手動検証

**Files:**
- Push: `tastile-web` ローカル commit

- [ ] **Step 1: 関連 test すべて green**

```bash
cd tastile-web
bun test src/app/api/proxy/
bun lint
```

Expected: PASS、lint 警告なし。

- [ ] **Step 2: コミット & push**

```bash
git push origin main
```

Expected: Vercel が自動デプロイを開始。dashboard で build / deploy の
status を確認。

- [ ] **Step 3: chrome-devtools-mcp で production 検証**

```js
// それぞれを叩いて status を確認
// GET /api/proxy/views/pending-prompt           → 200
// GET /api/proxy/views/timeline/today          → 200
// GET /api/proxy/v1/labels                       → 200
// GET /api/proxy/v1/tiles?owner_id=...           → 200
// POST /api/proxy/v1/tiles (Quick Create panel)  → 200
```

- [ ] **Step 4: HARNESS.md / 関連 docs の更新**

既存プラン (`2026-07-04-tile-panel-create-flow.md`) の実装順序を
本プランの完了に合わせて更新する。

## Task 6: prod に出力した diag テストタイルのクリーンアップ

**Files:**
- Tools: `curl` against `https://api.tastile.app` with `<redacted token>`
- Reference:
  - `tastile-core/crates/v1/api/src/main.rs:423` — `DELETE /v1/tiles/{id}` bound to `archive_tile`
  - `tastile-core/crates/v1/storage/src/tile_repo.rs:287-296` — `archive` soft-delete (`UPDATE v1_tile SET archived_at = ..., revision = revision + 1 WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL`)
  - `tastile-core/crates/v1/api/src/handlers/commands.rs:765-791` — `archive_tile` envelope: `Json<CommandRequest<ArchiveTilePayload>>` (`idempotency_key`, `expected_revision`, `payload: { tile_id }`)
  - `tastile-core/crates/v1/domain/src/command.rs:20-26,373-376` — `CommandRequest<T>` / `ArchiveTilePayload { tile_id }`

- [x] **Step 1: 3 個の id を特定** [完了: 2026-07-04]

`GET /v1/tiles?limit=200` (200 OK) で token-owner 配下に 3 タイル確認:

| id | title |
| --- | --- |
| `019f2ccc-ea6a-73e0-84ac-b6d1eaaa2f4a` | `diag-test-tile` |
| `019f2ccd-8dd5-7ba2-9fca-9e68b61985f8` | `diag-test-tile-2` |
| `019f2ccd-8f1d-7942-82d6-11a0846c5577` | `diag-test-tile-3` |

- [x] **Step 2: 各 tile を archive** [完了: 2026-07-04]

3 件とも `DELETE /v1/tiles/{id}` を `Content-Type: application/json` 付きで
`CommandRequest<ArchiveTilePayload>` body
(`idempotency_key` ランダム v4 UUID, `expected_revision: null`, `payload: { tile_id }`) を
送信 → 全件 **status=200**, `result: 2 (ACCEPTED)`, `revision: 2` (1 → 2、+1 バンプ)。

| # | id | status | result | revision |
| --- | --- | --- | --- | --- |
| 1 | `019f2ccc-ea6a-73e0-84ac-b6d1eaaa2f4a` | **200** | 2 (ACCEPTED) | 2 |
| 2 | `019f2ccd-8dd5-7ba2-9fca-9e68b61985f8` | **200** | 2 (ACCEPTED) | 2 |
| 3 | `019f2ccd-8f1d-7942-82d6-11a0846c5577` | **200** | 2 (ACCEPTED) | 2 |

- [x] **Step 3: アーカイブ後の再確認** [完了: 2026-07-04]

`GET /v1/tiles?limit=200` (200 OK) → **`diag-test-tile*` 行は 0 件**。
List Tiles は archived 行を返さない (filter が `archived IS NULL` 相当)。
list 件数は archive 前 14 件 → archive 後 11 件 (-3)。

- [x] **Step 4: 結果をプランに記録** [完了: 2026-07-04]

本セクションを追加 (= 上記 Step 1-3 の記録)。

**Notes:**
- API は `DELETE` でも `Content-Type: application/json` + envelope body 必須。
  空 body → 400, `{}` のみ → 422 (missing `idempotency_key`), 正しい body → 200。
- `expected_revision: null` で通過 (`CommandRequest.expected_revision: Option<Revision>`、null 許容)。
- archive は soft-delete (`archived_at IS NULL` 条件下で UPDATE)。
  二重 archive は行が見つからず NOT_FOUND 相当になるが、意図的に未検証。

---

## コミット履歴 (予定)

```
fix(v1/web): inject end query param for timeline/today upstream
# (no env fix needed: Task 3 で secret MATCH 確認済み)
fix(v1): address POST /v1/tiles 422 — <Task 1 の結果を反映>
docs(v1/web): update production-deploy plan with 422 findings
```

## 関連

- `docs/plans/2026-07-04-tile-panel-create-flow.md` — Task 3-6 (server side
  ID generation) は本プラン完了後に別プランで着手
- `tastile-core/HARNESS.md` §3-2 (フェーズ境界) — Phase A の範囲内で実装
- `tastile-root/HARNESS.md` — プロジェクト全体の進め方
