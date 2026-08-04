# B1b1 — timezone + window math

## メタデータ

- **ID**: B1b1
- **Phase**: 1 (QuickCreate wire contract)
- **Target repo**: `tastile-web`（core の既存 window contract を検証）
- **Sub-project parent**: B (time + windows)
- **Depends on**: B1a (endpoints)
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md` §B1b
- **Sibling plans**: B1a (endpoints), B2a (resolve from web)

## 前提

- QuickCreate のフォームはユーザーのブラウザのローカル時刻を `Date` として保持し、wire では core v1 の half-open interval `[since, until)` を使う。
- ブラウザの IANA timezone は `Intl.DateTimeFormat().resolvedOptions().timeZone` で取得する。例: `Asia/Tokyo`。
- core は `since` / `until` を UTC ISO8601 として受け取り、`tz` に従って window の意味を解釈する。`until: null` は open-ended window。
- 変更前に `tastile-web/CLAUDE.md`、該当する core の v1 window/API spec、B1a の endpoint contract を確認する。実装時は `tastile-web` のブランチで作業し、root の plan は変更しない。

## 目的

QuickCreate の local-time 入力を、timezone 情報を失わず core が解釈できる `WindowV1` に変換する単一経路を作る。`tastile-web/src/lib/time/window.ts` が `buildWindow(start: Date, end: Date | null, tz: string): WindowV1` を export し、全 caller はこの関数だけを使う。通常 window、DST 境界、open-ended、無効な順序・timezone を同じ contract として wire/E2E で証明する。

## 受入条件

- `2026-08-04 10:00 JST` を入力すると wire の `since` は `"2026-08-04T01:00:00Z"` になり、同じ window に `tz: "Asia/Tokyo"` が常に含まれる。
- 固定 fixture の spring-forward 境界を跨ぐ window は、local clock の指定を維持し、各端点の UTC offset を正しく反映する。core の placement count が期待値になる。
- `end: null` は `{since: <iso>, until: null, tz: <browser tz>}` となり、core の default 90 日分の placements を返す。web は rolling window で再取得できる。
- `start = end` は空の half-open window となり、DB count で placements が 0 件。
- `start > end` は core の HTTP 400 と `invalid_window`。
- 不明な `tz` は core の HTTP 400 と `invalid_tz`。
- `window.ts` 以外の caller が個別に `toISOString()`、timezone 推測、DST 補正を行わない。

## 実装手順

1. **既存 contract と call site を特定する。**
   - `tastile-web/src/lib/time/`、QuickCreate の form/action、B1a の request builder を確認する。
   - `WindowV1` の既存型があれば再利用し、重複型を作らない。`until` は nullable のまま wire に出す。
   - core 側の validation/error shape と 90-day default を確認し、web で勝手に再実装しない。

2. **timezone conversion の failing unit test を書く。**
   - 固定 fixture として `America/New_York` の `2026-03-08` spring-forward を使う。local `01:30` と `03:30` は、存在しない `02:xx` を生成せず、IANA timezone conversion の結果を期待値として固定する。
   - `Asia/Tokyo` の `2026-08-04 10:00` → `2026-08-04T01:00:00.000Z` を明示する。
   - `Date` の作り方は環境依存の `new Date("2026-08-04 10:00")` を避け、テスト helper または date-fns-tz/Temporal で zone を指定する。

3. **単一の `buildWindow` 実装を追加する。**
   - 対象: `tastile-web/src/lib/time/window.ts`。
   - `tz` を引数として必ず保持し、local-time `Date` を UTC ISO8601 に変換する。ライブラリは既存依存を優先し、未導入なら `date-fns-tz` を採用する。Temporal を選ぶ場合は polyfill を browser/server bundle 方針とともに確認する。
   - `end === null` は `until: null`、それ以外は UTC `toISOString()`。関数は純粋にし、現在時刻・fetch・フォーム状態を内部参照しない。
   - start/end の順序を web で別エラーに置き換えず、core が `invalid_window` を返せる wire を作る。未知 timezone の判定も canonical な core validation に委ねる。

4. **全 caller を `buildWindow` に寄せる。**
   - browser timezone を一度取得する共通 helper を使い、全 window payload に `tz` を含める。
   - QuickCreate の create request、open-ended の rolling re-fetch、B1a endpoint adapter の window construction を対象に、直接変換処理を削除する。
   - `window.ts` の export と `WindowV1` の import boundary を揃え、SSR で browser API を評価しない。timezone は client action/request 実行時に取得または明示引数で渡す。

5. **core-backed integration/E2E fixture を追加する。**
   - 実 DB に接続できる test harness を使い、skip した test を成功扱いにしない。
   - 通常、DST、open-ended、equal、reverse の各 window で create → timeline/resolve → DB placement count を確認する。
   - open-ended は core の 90 日 default を確認し、web の rolling re-fetch は `since` を固定し `until` を更新する request を観測する。

6. **caller wiring とテストを実行してからコミットする。**
   - 変更対象以外の差分がないことを `git status --short` で確認する。
   - commit は B1b の conversion/wiring/test に限定する。B1a endpoint 実装や B2a resolve 表示はこの計画の scope 外。

## 検証手順

### 1. 静的確認

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
rg "buildWindow|resolvedOptions\(\)\.timeZone|toISOString\(\)" src
```

期待: window wire の生成は `src/lib/time/window.ts` に集約され、QuickCreate/endpoint caller に独自 timezone math がない。型検査で `until: null` が拒否されない。

### 2. unit tests

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun test src/lib/time/window.test.ts
bun run typecheck
```

期待: JST fixture、DST fixture、open-ended、equal、reverse の conversion/shape test が PASS。`start = end` は同一 ISO、`end: null` は null。

### 3. core-backed API/E2E

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:e2e -- --grep "window|timezone|DST|open-ended"
```

期待する観測結果:

- JST fixture の request payload に `since: "2026-08-04T01:00:00Z"`（millisecond 表記を使う実装なら API contract に合わせて同値）と `tz: "Asia/Tokyo"`。
- spring-forward fixture の両端点が正しい UTC offset で送信され、placement count が fixture の期待値。
- open-ended の初回 response が 90 日分、rolling re-fetch が観測可能。
- equal window の DB placement count が `0`。
- reverse window が HTTP `400`、error code `invalid_window`。
- unknown timezone が HTTP `400`、error code `invalid_tz`。

### 4. 実ブラウザ確認

Chrome DevTools MCP で QuickCreate を開き、local-time form を入力して create request の Network payload を観測する。表示上の `10:00 AM JST` と wire 上の `2026-08-04T01:00:00Z` が一致し、payload の全 window に browser IANA timezone があることを確認する。テストが green でも Network と実際の placement count を確認する。

## リスク

- **環境依存の Date parsing**: zone なし文字列は実行環境の local zone に依存する。zone-aware helper/fixture を必須にし、裸の date string parsing を禁止する。
- **DST の nonexistent/ambiguous local time**: spring-forward の `02:xx` を入力 fixture にしない。存在しない時刻の UI validation/rounding 方針が必要なら別 task として明記し、B1b は library/core の canonical behavior に従う。
- **ブラウザと SSR の timezone 差**: server 側で `resolvedOptions()` を module load 時に呼ばない。browser request boundary で取得し、SSR hydration mismatch を避ける。
- **ライブラリ重複**: date-fns-tz と Temporal polyfill を同時導入しない。既存 package lock と browser bundle size を確認して一方だけ採用する。
- **open-ended の過剰取得**: web が 90 日を独自に固定すると core の default とずれる。初回は `until: null` のまま送り、rolling re-fetch の責務を B2a と調整する。
- **skipped integration test**: Postgres/API が到達不能な場合は PASS と宣言せず、環境 blocker として報告する。実 DB count と HTTP status の証拠がない限り受入条件は未検証。

## 関連

- Canonical template: `tile-create-e2e-wiring/04-plans/G1a-wslc-image-build.md`
- Parent overview: `tile-create-e2e-wiring/00-overview.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- B family: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md`
- Sibling plan: `tile-create-e2e-wiring/04-plans/B1a-endpoints.md`
- Sibling plan: `tile-create-e2e-wiring/04-plans/B2a-resolve-from-web.md`
- Web harness: `tastile-web/CLAUDE.md`
