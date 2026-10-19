# C1c — interval unit round-trip E2E

## メタデータ

- **ID**: C1c
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C1a
- **Sibling plans**: C2*（`endDate` + `life.active`）
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md:35-40` §変更手順 3

## 前提

- C1a が Green で、QuickCreate の作成要求が `POST /v1/schedule-definitions` を通って `v1_source_schedule` へ永続化される。
- QuickCreate に interval unit picker が存在し、`recurring.intervalValue` と `recurring.intervalUnit` に `min` / `hour` / `day` を設定できる。
- 親仕様は `recurring.intervalValue/Unit` を `generation.interval_ms` へ写像する（`tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md:14,31,39`）。
- core の `SourceGeneration.interval_ms` は `Option<DurationMs>` であり（`tastile-core/crates-v1/domain/src/source_schedule.rs:22-33`）、StepGenerator の `step` も `DurationMs` で表現される（`tastile-core/v1/08-recurring-and-frame.md:66-73`）。

## 目的

QuickCreate の `recurring.intervalValue` と `recurring.intervalUnit` を wire-builder がミリ秒へ正しく変換し、core が同じ値を `generation.interval_ms` として永続化することを、`min` / `hour` / `day` の全 3 単位で E2E 検証する。

## 受入条件

新規 spec `tastile-web/e2e/c1c-interval.spec.ts` が次の 3 ケースを UI submit から DB 観測まで検証し、すべて Green になる。

| UI `intervalValue` | UI `intervalUnit` | 表示上の値 | 期待する DB `generation.interval_ms` |
| ---: | --- | --- | ---: |
| 30 | `min` | 30 min | 1,800,000 |
| 2 | `hour` | 2 hour | 7,200,000 |
| 1 | `day` | 1 day | 86,400,000 |

- 各ケースで成功表示を待ってから、作成対象を一意な title または spec が取得した source ID で特定する。
- `SELECT generation->>'interval_ms' FROM v1_source_schedule ...` の結果を整数として比較し、文字列の見た目だけでは判定しない。
- 3 ケースを一括実行した `bun` E2E が exit code 0 になる。
- 0 または負数は本計画の正常系 3 ケースに混ぜず、既存 validator が拒否する契約を維持する。

## 実装手順

1. **既存 E2E helper と C1a の submit 経路を再利用する**
   - `tastile-web/e2e/` の QuickCreate spec と helper を確認し、認証、パネル起動、成功待機、DB 接続を複製しない。
   - C1a の payload/wire 経路を変更せず、本計画は round-trip の観測を追加することに限定する。

2. **失敗する E2E spec を新規作成する**
   - Create: `tastile-web/e2e/c1c-interval.spec.ts`
   - 3 ケースを table-driven test にし、各ケースに一意な title（例: `C1c 30 min <run-id>`）を与える。
   - 各ケースで QuickCreate を開き、interval repeat mode を選び、`intervalValue` と `intervalUnit` を入力して submit する。
   - UI 操作はラベルまたは role を使い、CSS class や DOM 順序に依存しない。

   ```ts
   const cases = [
     { value: 30, unit: "min", expectedMs: 1_800_000 },
     { value: 2, unit: "hour", expectedMs: 7_200_000 },
     { value: 1, unit: "day", expectedMs: 86_400_000 },
   ] as const;
   ```

3. **各 submit 後に DB の永続値を取得する**
   - `v1_source_schedule` を、作成レスポンス由来の source IDを優先し、利用できなければ一意な title と owner の関連付けで特定する。
   - DB helper から次の SQL と同等の問い合わせを実行する。

   ```sql
   SELECT (generation->>'interval_ms')::bigint AS interval_ms
   FROM v1_source_schedule
   WHERE id = $1;
   ```

   - 現行 schema/helper が ID を直接返さない場合のみ、既存 C1a helper の検索条件を利用する。`ORDER BY created_at DESC LIMIT 1` だけに依存して並列 test の別行を拾わない。
   - 取得値を `BigInt` または安全な decimal string として期待値へ比較する。今回の最大値は JavaScript safe integer 内だが、DB の `bigint` 契約を狭めない。

4. **RED を確認する**

   ```bash
   cd tastile-web
   bun run e2e -- e2e/c1c-interval.spec.ts
   ```

   - 期待: spec 未実装時または単位変換に欠陥がある時、該当 case が FAIL し、期待値と DB 実値が表示される。
   - DB/API stack 不在による connection error や skip は変換 contract の RED とみなさない。C1a の stack を起動して再実行する。

5. **必要な場合だけ最小の conversion 修正を行う**
   - 3 ケースのいずれかが誤値なら、C1a が導入した `tastile-web` の QuickCreate schedule wire-builder と対応 unit test のみを修正する。
   - 単位倍率は `min = 60_000`、`hour = 3_600_000`、`day = 86_400_000` とし、変換結果を `generation.interval_ms` に渡す。
   - UI store、core domain 型、DB schema は変更しない。core の型は既に `DurationMs` を受ける（`tastile-core/crates-v1/domain/src/source_schedule.rs:30`）。
   - Unit enum 名が実コードで異なる場合は picker/store の既存値を正本に合わせ、推測した別名を追加しない。

6. **3 ケースを Green にする**

   ```bash
   cd tastile-web
   bun run e2e -- e2e/c1c-interval.spec.ts
   ```

   - 期待: `30 min`, `2 hour`, `1 day` の全ケースが PASS、0 failed。

## 検証手順

1. wslc stack と QuickCreate 用 web server を C1a の手順で起動する。
2. spec を実行する。

   ```bash
   cd tastile-web
   bun run e2e -- e2e/c1c-interval.spec.ts
   ```

   期待: 3 cases Green、exit code 0。skip は Green とみなさない。

3. DB を直接観測する。

   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c \
     "SELECT generation->>'interval_ms' FROM v1_source_schedule ORDER BY created_at DESC LIMIT 3"
   ```

   期待: 本 spec が作成した 3 行として `1800000`、`7200000`、`86400000` が確認できる。順序には依存せず、title/source ID と照合する。

4. 個別値を厳密に照合する場合は、spec が記録した source ID ごとに実行する。

   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c \
     "SELECT (generation->>'interval_ms')::bigint FROM v1_source_schedule WHERE id = '<source-id>'"
   ```

   期待: 対応する UI ケースごとに `1800000` / `7200000` / `86400000` のいずれか 1 値だけが返る。

## リスク

- **Unit enum mismatch**: UI/store/wire の値が `min` / `hour` / `day` と一致せず、`minute` や複数形になっている可能性がある。picker が実際に保存する値を確認し、その既存 contract に沿って test data を定義する。黙って default 倍率へ fall through させない。
- **ms precision / bigint handling**: DB 値を JavaScript `number` へ無条件変換すると、将来大きい interval で精度を失う。SQL で `bigint` cast し、helper 側は decimal string または `BigInt` で比較する。core 側も `DurationMs` として保持する（`tastile-core/crates-v1/domain/src/source_schedule.rs:30,65-75`）。
- **zero/negative interval**: 0 または負数は validator が拒否すべきであり、倍率計算で正値へ矯正しない。本 spec の正常系は正の 3 ケースだけに限定し、validator の既存拒否を壊さない。
- **並列 E2E の誤行取得**: `ORDER BY created_at DESC LIMIT 1` のみでは他 test の schedule を拾える。一意 title/owner または source ID を必須にする。
- **表示値と保存値の取り違え**: UI に「1 day」と見えても wire が hour として送る可能性があるため、成功 toast だけでは受入にしない。必ず `v1_source_schedule.generation.interval_ms` を観測する。

## 関連

- Parent C: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md:2-4,14,29-31,35-40,45-58`
- C1a: QuickCreate → core の wire-builder / submit 基盤。本計画の必須依存。
- C1b: `tile-create-e2e-wiring/04-plans/C1b-weekday-mask-roundtrip.md:1-29`（同じ SourceSchedule round-trip 系の sibling）。
- C2*: `recurring.endDate` → `generation.ends_at` と `life.active.{startDate,endDate}` → `generation.date_range_{start,end}` の検証（親仕様 `C-recurring-source.md:40`）。
- Core interval field: `tastile-core/crates-v1/domain/src/source_schedule.rs:22-33,65-75`。
- Step duration spec: `tastile-core/v1/08-recurring-and-frame.md:66-73`。
