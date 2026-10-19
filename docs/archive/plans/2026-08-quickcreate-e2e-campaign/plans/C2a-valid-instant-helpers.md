# C2a — `validInstant()` / `datePart()` ヘルパの検証

## メタデータ

- **ID**: C2a
- **Phase**: 1
- **Target repo**: `tastile-web`（ヘルパの unit test 追加）
- **Sub-project parent**: C（Recurring + SourceSchedule）
- **Depends on**: なし（純粋関数、本ファイル単独で完結）
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"LocalDate vs Instant" リスク + `quick-create-schedule-wire.ts:25-36`
- **Sibling plans**: C1a（recurring.kind roundtrip）、C1b（weekday mask roundtrip）、C2b（end_date vs active.end_date）

## 前提

- `quick-create-schedule-wire.ts:25-36` 付近に以下の 2 ヘルパが定義されている（または同等の pure function が同名で存在）:
  - `validInstant(s: string): string | null` — ISO8601 Instant 文字列を受けて、不正なら `null`、正しければ正規化して返す
  - `datePart(s: string): string | null` — YYYY-MM-DD 形式の `LocalDate` 文字列を受けて、不正なら `null`、正しければパススルー
- 現状、ヘルパは存在するが unit test が薄い／欠落している（`04-sub-projects/C-recurring-source.md` §"LocalDate vs Instant" で `recurring.life.active.{startDate,endDate}` の `LocalDate` ↔ `generation.starts_at/ends_at` の `Instant` 混同リスクが指摘されている）
- `tastile-web` 既存の vitest 構成が `bunx vitest run` で実行可能

## 目的

`validInstant()` と `datePart()` の入出力境界を unit test で完全に固定する。本ファイルは **ヘルパの実装変更を伴わず、テスト追加のみ**。これにより C1a や C2b（end_date vs active.end_date）で将来起きる「`life.active.endDate` が Instant として扱われて timezone coerce される」バグのリグレッションを最上流で防ぐ。

## 受入条件

- `validInstant()` の unit test が以下のケースをカバー:
  - `"2026-08-03T09:00:00+09:00"` → 正規化済み ISO8601 文字列で pass through
  - `"2026-08-03T09:00:00Z"` → 同上
  - `"2026-08-03"` (date only) → `null`（Instant ではない）
  - `""` → `null`
  - `"not-a-date"` → `null`
  - `"2026-13-99T99:99:99Z"` → `null`（不正値でクラッシュしない）
  - `null` / `undefined` 入力（型ガード外）→ `null`（throw しない）
- `datePart()` の unit test が以下のケースをカバー:
  - `"2026-08-03"` → パススルー（同一文字列）
  - `"2026-08-3"` (月/日ゼロ埋めなし) → `null`（YAML strict regex に従う）
  - `"2026/08/03"` → `null`（セパレータ不正）
  - `""` → `null`
  - `"invalid"` → `null`
  - ISO with offset 文字列 `"2026-08-03T09:00:00+09:00"` → `null`（Instant 拒否）
- `bunx vitest run app/lib/quick-create/__tests__/valid-instant-helpers.test.ts` で全ケース pass
- ヘルパの実装ファイル（`quick-create-schedule-wire.ts:25-36`）は変更ゼロ

## 実装手順

1. **テストファイル作成**:
   - 配置: `tastile-web/app/lib/quick-create/__tests__/valid-instant-helpers.test.ts`
   - vitest describe / it ブロックで上記受入条件ケースを実装

2. **`validInstant()` のテスト**:
   ```ts
   import { describe, expect, it } from "vitest";
   import { validInstant, datePart } from "../schedule-wire-path"; // 実際のパスに合わせる

   describe("validInstant()", () => {
     it("accepts ISO8601 with offset", () => {
       expect(validInstant("2026-08-03T09:00:00+09:00")).toBe("2026-08-03T09:00:00+09:00");
     });
     it("accepts ISO8601 with Z", () => {
       expect(validInstant("2026-08-03T09:00:00Z")).toBe("2026-08-03T00:00:00Z");
     });
     it("rejects date-only string", () => {
       expect(validInstant("2026-08-03")).toBeNull();
     });
     it("rejects empty string", () => {
       expect(validInstant("")).toBeNull();
     });
     it("rejects garbage", () => {
       expect(validInstant("not-a-date")).toBeNull();
     });
     it("rejects impossible date components", () => {
       expect(validInstant("2026-13-99T99:99:99Z")).toBeNull();
     });
     it("does not throw on null/undefined input", () => {
       // @ts-expect-error: runtime input contract
       expect(validInstant(null)).toBeNull();
       // @ts-expect-error: runtime input contract
       expect(validInstant(undefined)).toBeNull();
     });
   });
   ```

3. **`datePart()` のテスト**:
   ```ts
   describe("datePart()", () => {
     it("accepts YYYY-MM-DD", () => {
       expect(datePart("2026-08-03")).toBe("2026-08-03");
     });
     it("rejects unpadded", () => {
       expect(datePart("2026-08-3")).toBeNull();
     });
     it("rejects slash separator", () => {
       expect(datePart("2026/08/03")).toBeNull();
     });
     it("rejects empty", () => {
       expect(datePart("")).toBeNull();
     });
     it("rejects instant-form string", () => {
       expect(datePart("2026-08-03T09:00:00+09:00")).toBeNull();
     });
   });
   ```

4. **ヘルパの実装ファイルパスの確認**:
   - `quick-create-schedule-wire.ts:25-36` の import path に上記テストからアクセスできるか確認
   - もし export されていなければテスト専用 re-export を最小追加（export 2 行のみ、本計画スコープの境界）

5. **既存テストランナー設定の確認**:
   - `tastile-web/vitest.config.ts` または `bunfig.toml` で `app/lib/quick-create/__tests__/**/*.test.ts` が拾われるか
   - もし設定なしなら `package.json` の `test` script に `--dir app/lib/quick-create/__tests__` を追加（本計画スコープの境界）

6. **CI 緑化**:
   - ローカルで `bunx vitest run` が exit 0
   - GitHub Actions の vitest job（本計画の受入条件とは別、C 計画全体の CI とは別タスク）

## 検証手順

```bash
# 1. テストファイル存在確認
test -f tastile-web/app/lib/quick-create/__tests__/valid-instant-helpers.test.ts \
  || echo "MISSING"

# 2. テスト実行
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/valid-instant-helpers.test.ts
# 期待: "Tests  X passed" (X = 受入条件ケース数 + 余白)

# 3. カバレッジ計測 (任意)
bunx vitest run --coverage app/lib/quick-create/__tests__/valid-instant-helpers.test.ts
# 期待: validInstant / datePart の branch coverage = 100%
```

## リスク

- **ヘルパの出力正規化仕様が未確定**: `validInstant("2026-08-03T09:00:00+09:00")` が正規化（秒の付与、`T` の大文字化など）を行うかパススルーだけかで結果が変わる。本計画のテストは「**入力をそのまま返すか、`null` を返すか**」の 2 値に絞っており、正規化仕様の詳細を固定しない。実装が正規化する場合、本計画のテストはその正規化結果に合わせること（修正は本計画の境界内）
- **`validInstant` の locale 依存**: ブラウザ／Node の `new Date()` のパースは locale によって結果が変わる可能性。実装が `new Date()` ベースであれば TZ 固定の引数のみ受け付ける、もしくは `@js-temporal/polyfill` 等を使う判断（本計画スコープ外、実装方針は別タスク）
- **vitest 未設定**: `tastile-web` の vitest セットアップが本計画のタイミングで未完なら、`vitest.config.ts` 作成から着手（本計画の「最小追加」境界を越える） → 別チケット推奨
- **ヘルパが export されていない**: 別ファイルから import できない場合はテスト専用の re-export ファイル（`valid-instant-helpers.ts`）を本計画スコープで最小作成可能

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"LocalDate vs Instant" リスク
- Domain spec: `tastile-core/v1/08-recurring.md` §26-39（LocalDate vs Instant の境界定義）
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C2 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - C1a（recurring.kind roundtrip）
  - C1b（weekday mask roundtrip）
  - C2b（end_date vs active.end_date）
