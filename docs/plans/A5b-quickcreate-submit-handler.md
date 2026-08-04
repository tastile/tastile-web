# A5b — QuickCreate submit handler (wire → POST → UI feedback)

## メタデータ

- **ID**: A5b
- **Phase**: 2 (QuickCreate wiring — submit half)
- **Target repo**: `tastile-web`
- **Sub-project parent**: A (QuickCreate + Core)
- **Depends on**: A5a (UI binding), A1b / A2a / A3a (form fields & wire builder), A2b (dispatch path / `publishScheduleDefinition`), H2a (bridge headers)
- **Source spec**: `04-sub-projects/A-tile-plan.md` §3
- **Sibling plans**: A5a (UI binding — caller side), A2b (`publishScheduleDefinition` & `ApiError` mapping), A4a (focus ring trigger), H2a (bridge header injection)

## 前提

- `tastile-web/src/shared/api/v1/submit.ts:47` の `submitCreateTile({ client })` は現状 `publishScheduleDefinition` を呼び `{ ok, tileId }` 風の discriminated union を返している。A5b はこれを **idempotency 付き + エラーカテゴリ別 + analytics 付き** の submit に再構成する。
- `quick-create-schedule-wire.ts` の throw サイト（`Plan.planning.flows` `:249-257`, `meta.project` / `meta.tags` `:240-242` 等）は A1b / A2a / A3a で除去済み（フォーム入力が空フィールドを渡さない前提）。submit パス上で再 throw する箇所は存在しない。
- `tastile-web/src/shared/api/v1/schedule-definition.ts` の `publishScheduleDefinition` が `POST /v1/schedule-definitions` への HTTP POST 本体を担う。A5b はこの上に idempotency ヘッダ、analytics、AbortController、リトライ戦略を **薄く** 載せる。
- H2a の bridge ヘッダ（`x-tastile-bridge-secret`, `Authorization: Bearer <idToken>`）は `ApiClient.getIdToken()` と `lib/cognito/cookies` 経由で自動付与済み。
- A4a で `?focus=<tileId>` クエリパラメータによるタイムラインのハイライトリングが配線済み。

## 目的

QuickCreate パネルで submit が押下された瞬間から、フォーム値が `v1_tile` + `v1_plan` の 1 行として core に永続化され、UI が成功（navigate + toast）/ 失敗（inline banner / retry toast）フィードバックを出すまでを end-to-end で成立させる。中核は **idempotency**、**typed error mapping**、**optimistic UI lock**、**analytics** の 4 つ。

## 受入条件

- 201 受信後 1 秒以内に `router.push("/dashboard/timeline?focus=" + response.id)` が走り、タイムライン上で当該 tile にハイライトリングが点灯する（chrome-devtools MCP で目視確認）。
- 400 応答時、inline error banner が QuickCreate パネル内に表示され、画面遷移は走らない。banner 文面は core の `ApiError.message`（A2c マッピング）をそのまま表示。
- 5xx / ネットワーク失敗時、`SubmitError`（`request_id` 付き）が throw され、retry toast が表示される。toast の「Retry」押下で **同じ Idempotency-Key** を再送し、core の 24h キャッシュから初回と同じ 201 が返る（DB に重複行なし）。
- submit ボタン押下中、`<Button>` が `disabled + loading`（Mantine の `Loader`）になり、submit 以外のフィールド（Identity / Plan / Meta-min）は編集可能のままロックされない。
- submit 開始から 5 秒経過しても POST が完了しない場合、「Taking longer than usual...」のヒント文を submit ボタン直下に表示する（spinner は維持）。
- DevTools Network タブで POST の `Idempotency-Key: <uuid v4>` ヘッダと、Console に `tile_create_attempt` analytics イベント（`{outcome: "success"|"error"|"retry", duration_ms, error_code?}`）の `console.info` ログが現れる。
- 同じ Idempotency-Key で連続して 2 回 submit した場合、2 回目も 201 が返るが、`v1_tile` の row count は増えない（core の idempotency cache が効いている）。
- `tastile-web/src/shared/api/v1/submit.ts` に新規 `submitTile` 関数が export され、A5a の `QuickCreate.tsx::onSubmit` から呼び出される。

## 実装手順

### 1. submit.ts の再構成 (`tastile-web/src/shared/api/v1/submit.ts`)

- 既存 `submitCreateTile`（`:47-53`）を **温存** し、`submitTile`（新 export、A5a からの呼び出し口）を追加する。`submitCreateTile` は Phase A のレガシー呼び出し口として薄ラッパで残す。
- 新 `submitTile({ client, signal?, onSlow? })` の構造:
  1. `crypto.randomUUID()` で `idempotencyKey` を生成
  2. `useQuickCreateStore.getState()` からフォーム値を読み、`buildQuickCreateSchedulePayload(state)` で wire を確定（throw しない前提）
  3. `performance.now()` で計測開始
  4. `AbortController` を生成し、5s タイマで `onSlow?.()` を発火し、20s タイマで `controller.abort()` を発火
  5. `publishScheduleDefinition({ client, payload, headers: { "Idempotency-Key": idempotencyKey }, signal: controller.signal })` を呼ぶ
  6. 結果に応じて:
     - `result.ok === true` → `analytics.track("tile_create_attempt", { outcome: "success", duration_ms })` → `return { ok: true, tileId: result.tileId, idempotencyKey }`
     - `result.ok === false && result.error.kind` が 4xx 系 → A2c の `ApiErrorKind` で型分岐し、typed error を throw（後述 §2）
     - `result.ok === false && result.error.kind` が 5xx / network → `SubmitError` を throw（後述 §3）
- `client.useProxyBridge === true` の場合、Idempotency-Key ヘッダは `/api/proxy/[...path]` 経由で core に届く（H2a の proxy がヘッダを forward する責務）。local dev (`NEXT_PUBLIC_TASTILE_CORE_V1_URL` 直接指定) では CORS preflight で `Idempotency-Key` が許可される前提。

### 2. Typed error mapping (A2c 連携)

- `tastile-web/src/shared/api/v1/submit.ts` に新ファイル `submit-errors.ts` を作り、`SubmitError` / `ValidationError` / `ConflictError` を export:
  ```ts
  export class SubmitError extends Error {
    constructor(public requestId: string, public cause?: unknown) {
      super(`submit failed: ${requestId}`);
      this.name = "SubmitError";
    }
  }
  export class ValidationError extends Error {
    constructor(public fields: Record<string, string>, public raw: ApiError) {
      super("validation failed");
      this.name = "ValidationError";
    }
  }
  export class ConflictError extends Error {
    constructor(public idempotencyKey: string, public raw: ApiError) {
      super("idempotency conflict");
      this.name = "ConflictError";
    }
  }
  ```
- `submitTile` は `ApiError.kind`（数値定数、`tastile-core/v1/14`）を見て:
  - `kind ∈ {400_kind, 422_kind}` → `ValidationError`（fields は `ApiError.violations[]` から key/value を抜き出す）
  - `kind === 409_kind && raw.idempotencyKey` → `ConflictError`（core が idempotency cache hit 後に矛盾を検出したケース。通常は発生しない）
  - `kind ∈ {500_kind, 502_kind, 503_kind, 504_kind}` または `fetch` が throw → `SubmitError`（`requestId` は `ApiError.requestId` ∨ `crypto.randomUUID()` のフォールバック）

### 3. UI submit handler (`tastile-web/src/features/create-tile/ui/QuickCreate.tsx`)

- A5a で決まった `onSubmit = handleSubmit(async (values) => { await submitTile(values); })` のラッパを、本 A5b で try/catch 付きの **本格ハンドラ** に書き換える:
  ```ts
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "slow">("idle");
  const [errorBanner, setErrorBanner] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setErrorBanner(null);
    setSubmitState("submitting");
    try {
      const res = await submitTile({
        client,
        onSlow: () => setSubmitState("slow"),
      });
      idempotencyKeyRef.current = res.idempotencyKey;
      localStorage.removeItem("tastile.draft.create-tile");
      router.push(`/dashboard/timeline?focus=${res.tileId}`);
    } catch (e) {
      if (e instanceof ValidationError) {
        setErrorBanner({ message: e.message, fields: e.fields });
      } else if (e instanceof SubmitError) {
        notifications.show({
          id: `retry-${e.requestId}`,
          color: "red",
          title: "Submit failed",
          message: "Click Retry to try again with the same Idempotency-Key.",
          action: <Button onClick={onSubmit}>Retry</Button>,
        });
      }
    } finally {
      setSubmitState("idle");
    }
  });
  ```
- `<Button type="submit" loading={submitState !== "idle"} disabled={submitState !== "idle"}>Submit</Button>` で楽観的 UI ロック
- `submitState === "slow"` のとき submit ボタン直下に `<Text size="xs" c="dimmed">Taking longer than usual...</Text>` を表示
- フィールドはロックしない（要件: 「the panel stays interactive for editing other fields」）。`useForm` の `disabled` は submit 中 `false` のまま。

### 4. Analytics

- `tastile-web/src/lib/analytics.ts`（既存がある場合）に `track(event, props)` を呼び出すヘルパを置く。無ければ最小実装:
  ```ts
  export function track(event: string, props: Record<string, unknown>) {
    if (typeof window === "undefined") return;
    // GA4 / Plausible 等への配送は本 A5b のスコープ外
    console.info(`[analytics] ${event}`, props);
  }
  ```
- `submitTile` 内で `track("tile_create_attempt", { outcome, duration_ms, error_code? })` を発火。`outcome` は `"success" | "error" | "retry"` の 3 値。`error_code` は `ApiError.kind` の数値を文字列化したもの。

### 5. QuickCreate.tsx と submit.ts の結線

- A5a が残した `await submitTile(values)` の 1 行を、上記 §3 の本格ハンドラで置換する。`submitTile` の import 元は `@/shared/api/v1/submit`。
- `client` は `makeClient()` の戻り値を `useMemo` 安定参照（render loop 回避、H2a 周辺の既存パターン踏襲）。

### 6. Core 側の idempotency キャッシュ前提

- core 側 (`tastile-core/crates-v1/api`) は `Idempotency-Key` ヘッダを 24h 保管し、重複 POST には初回 201 のキャッシュを返す責務を持つ。**A5b の web 側単体では検証しきれない** ため、`tastile-core` 側の idempotency 実装ステータス（plan 番号未定）を確認し、無ければ Phase 2 の前に最小実装を依頼する。受入条件「同じ Idempotency-Key で 2 回 submit → 2 回目も 201、row count 増えない」を成立させる前提条件。

## 検証手順

```bash
# 1. unit: submitTile の typed error 分岐
cd tastile-web
bun test src/shared/api/v1/submit.test.ts
# 期待: 4xx → ValidationError throw, 5xx → SubmitError throw, network reject → SubmitError throw
# 期待: test result: ok. N passed; 0 failed; 0 ignored

# 2. e2e: 成功 → navigate + focus ring
bunx playwright test e2e/quick-create-submit.spec.ts -g "success navigates"
# 手順: QuickCreate を全タブ埋めて Submit
# 期待: URL が /dashboard/timeline?focus=<uuid> に遷移、focus ring が当該 tile に点灯
# 期待: POST の Idempotency-Key ヘッダが UUID v4 形式

# 3. e2e: 4xx → inline banner, navigate しない
bunx playwright test e2e/quick-create-submit.spec.ts -g "400 shows inline banner"
# 手順: core に invalid payload を返すよう network.route で intercept
# 期待: banner 表示、URL 変化なし、analytics に outcome=error

# 4. e2e: network drop → retry toast, 同じ Idempotency-Key で 2 回目 201
bunx playwright test e2e/quick-create-submit.spec.ts -g "retry uses same key"
# 手順: 1 回目 POST を network.route で abort、retry 押下
# 期待: 2 回目に送られた Idempotency-Key が 1 回目と一致、DB row count 増えず

# 5. e2e: 5s slow notice
bunx playwright test e2e/quick-create-submit.spec.ts -g "slow notice"
# 手順: network.route で POST を 6 秒遅延
# 期待: 5 秒経過時点で "Taking longer than usual..." 表示

# 6. dev 手動 (任意)
cd tastile-web
bun run dev
# → http://localhost:3000/dashboard/timeline で Create → 全タブ入力 → Submit
# → DevTools Network で POST の Idempotency-Key ヘッダ確認
# → DevTools Console で [analytics] tile_create_attempt ログ確認
# → タイムラインで focus ring 点灯を目視
```

## リスク

- **Core 側 idempotency 未実装**: 上記 §6 の前提が崩れると、受入条件「同 key で 2 回 201、row 増えない」が成立しない。Phase 2 開始前に core 側の idempotency 実装有無を確認すること。
- **H2a の proxy が Idempotency-Key を strip する可能性**: `/api/proxy/[...path]` の rewrite ルールがカスタムヘッダを落とす実装になっていると、submit 側で送っても core に届かない。proxy のヘッダ forward 実装を H2a の spec と突き合わせて確認する。
- **Mantine `notifications.show` の action button が disabled 中にも押せる**: `submitState !== "idle"` の間、retry toast の action button を `disabled` にしないと二重 submit が起きる。`action` に渡す `<Button>` に `disabled={submitState !== "idle"}` を必ずつける。
- **5s/20s タイマのリーク**: component unmount 後に `setSubmitState` を呼ぶと React の警告。`useEffect` の cleanup で timer を clear するか、AbortController の `signal` を React state とは独立に管理する。
- **analytics の `console.info` が prod で残る**: GA4 等の実配送に繋ぐ前に、`NODE_ENV === "production"` では `console.info` を黙らせるか、適切な redaction を通す。`NEXT_PUBLIC_ANALYTICS_DEBUG=1` 等のフラグで opt-in にするのが安全。
- **`crypto.randomUUID()` の SSR**: フォーム送信はクライアント側でしか走らないため問題なし。ただし unit test が jsdom 上で `crypto` を要求するため、vitest の `environment: "happy-dom"` または polyfill が必要。
- **localStorage 復元中に submit された場合**: 復元ドラフトが古い Idempotency-Key を持っていないか確認。A5b では idempotencyKeyRef を `useRef`（session-local）で持ち、ドラフトには載せない方針で安全。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sibling plans: `04-plans/A5a-quickcreate-ui-binding.md`, `04-plans/A2b-plan-planning-references.md`, `04-plans/A2c-error-mapping.md`（存在する場合）, `04-plans/A4a-owner-derived-from-sub-e2e.md`, `04-plans/H2a-bridge-headers.md`（存在する場合）
- Wire builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts`
- Dispatch: `tastile-web/src/shared/api/v1/schedule-definition.ts` (`publishScheduleDefinition`)
- Current submit entry: `tastile-web/src/shared/api/v1/submit.ts:47` (`submitCreateTile` — 本 A5b で `submitTile` を併設)
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
