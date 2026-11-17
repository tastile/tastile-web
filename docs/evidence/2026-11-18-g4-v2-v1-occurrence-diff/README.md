# G4 (web#219) item E — v2 候補 vs Core v1 materialization 再計測

`../2026-11-14-g4-v2-v1-occurrence-diff/baseline/` は旧 contract
(OpenAPI v3.2.0 系、Core monthly fix 前) の stale 結果であり、現行
評価には流用しない。本ディレクトリ `remeasure/` は **現行 contract での
新規実測** である。

## 計測条件 (すべて固定)

- Core: `release-1-1-0` @ `d148241d` (data preservation #340 +
  OpenAPI endpoints #338 を含む HEAD)
- OpenAPI: `tastile-openapi` v3.5.0 (submodule `8a61003`)
- v2 toolchain: `tc-v2-toolchain` @ `9ecda70f7a2b5b2e910caa7f8ef76a422328170f`
  の release build `tastile-v2` + seeded store/lock
- 実行先: `tastile-root/deploy/verify-stack` の isolated verify stack
  (fresh DB、fake delivery provider、loopback のみ)。運用 SoT には
  一切触れていない。各 case は fresh owner/session。
- script: `scripts/v2-v1-occurrence-diff.ts` (本 PR で §15 list
  envelope 対応済み — 後述)

## 結果 (2026-11-18、2 回連続実行で同一分類 = deterministic)

| case | v2 candidates | v1 occurrences | v1 placements (in range) | exact span | v2-only | v1-only | cause | semantics |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| daily-basic | 14 | 90 | 14 | 14 | 0 | 0 | `none` | - |
| weekly-mask-30m | 667 | 426 | 426 | 426 | 241 | 0 | `v2_input_gap` | `weekday_mask`, `period_boundary` |
| monthly-by-day-15 | 14 | 2 | 2 | 0 | 14 | 0 | `v2_input_gap` | `monthly_rule` |
| interval-12h | 28 | 26 | 26 | 26 | 2 | 0 | `v1_period_boundary` | `period_boundary` |
| daily-excluded | 14 | 88 | 88 | 12 | 2 | 0 | `v2_input_gap` | `excluded_dates` |

`v1 occurrences` は detail read の全行数 (horizon 全体)、`placements
(in range)` は v2 eval range との交差。v2 candidate は advisory で
あり materialized placement ではない (`candidateNote` 参照)。

## 分類の読み方

- **`none` (daily-basic)**: v2 candidate 14 件すべてが v1 placement
  span と完全一致。Core read-back も `kind=1, offset_min=540` を正しく
  返した。
- **`v2_input_gap` / `monthly_rule`**: Core は `kind=3 +
  monthly_rule{day_of_month:15}` と `ends_at=2027-01-16` を保存し、
  15 日のみに materialize した (Dec 15 / Jan 15 の 2 件)。v2 eval
  port は monthly selector を持たず daily-step 近似のため range 全体に
  14 candidate を出す。**Core 側の保存・read-back に regression なし**
  (`generationReadBack.monthlyRule` に値あり)。
- **`v2_input_gap` / `weekday_mask` + `period_boundary`**: v1 は
  `weekday_mask=31` (月〜金) と `ends_at≈2 週間` で 426 件を
  materialize。v2-only 241 件は authored horizon 外および mask 非対応
  に起因。Core は mask を正しく保存・適用。
- **`v1_period_boundary` (interval-12h)**: v2 range 末尾 2 件は v1 の
  authored `ends_at` horizon 外で materialize されない。意図された
  境界差。
- **`v2_input_gap` / `excluded_dates`**: v1 は
  `excluded_dates=[2026-11-19, 2026-11-21]` を保存・適用し、その 2 日を
  placement しない。v2 は excluded_dates を表現できず candidate に
  含める → v2-only 2 件。

**`suspected_regression` / `nondeterminism` / `pending` は 0 件。**
Core の schedule semantics 保存・materialization に現行 HEAD での
乖離は検出されなかった。

## script 修正 (本 PR に含む)

初回の再計測試行で全 case が `pending` になった原因は、Core が
v1/14 §15 の list contract (OpenAPI v3.3.0+) に移行し、detail read の
`occurrences` / `placements` が bare array ではなく
`{ items, count, next_cursor }` envelope を返すようになったため。
script は旧来の `Array.isArray` 前提で envelope を読み捨てていた。

- `listItems()` で envelope/bare array の両方を正規化
- poll は `occurrence_limit=1000&placement_limit=1000` で第 1 ページを
  取得し、count/signature で安定判定
- 分類前に `fetchDetailFull()` で `occurrence_cursor` /
  `placement_cursor` を独立に辿り全行を取得

## 実行方法

```bash
VERIFY_CORE=http://127.0.0.1:31410 \
TASTILE_WEB_BRIDGE_SECRET=<verify-stack secret> \
TASTILE_V2_CLI=<path>/tastile-v2 \
TASTILE_V2_STORE=<seeded store dir> \
TASTILE_V2_LOCK=<seeded store dir>/scheduler-option.lock.json \
bun scripts/v2-v1-occurrence-diff.ts --out <dir>
```

前提は `../2026-11-14-g4-v2-v1-occurrence-diff/README.md` と同じ
(isolated Core + それを向く Next.js dev server + 実 PostgreSQL)。
v2 toolchain が無い環境では全 case `skipped` で v1 submit は走らない。

## 既知の制限 (独立レビュー指摘)

- `diffCase` は v2-only candidate を occurrence の `state`/`blocked` と
  相関させない。fresh single-owner 計測では blocked occurrence は発生
  しないが、break/他 source 由来の blocked occurrence がある環境では
  `suspected_regression` の false positive になり得る。
- `beyondMaterialized` の frontier 判定は Core 自身の occurrence 出力を
  参照するため、Core が早期に generation を打ち切る regression がある
  場合に `v1_period_boundary` へ分類され得る (cause は `none` になら
  ないが `fullyExplained` になり得る)。
- これらは本計測 (fresh owner、blocked 無し、horizon 内で安定) の結果を
  無効化するものではないが、一般化する際は occurrence state 相関と
  authored `ends_at` 到達確認の追加が必要。

## item D への示唆 (再計測後)

- weekly mask / excluded_dates / monthly の乖離はすべて **v2 preview
  port の入力表現不足**であり、Core contract の問題ではない。
- monthly は v1 が `kind=3` を正しく submit・保存・materialize する
  ことを確認。残る乖離は v2 preview の daily-step 近似のみで、
  v2 port への monthly selector 追加または preview 文言での近似明示は
  別 issue の判断事項。
- v2 候補数 ≠ 最終予定数 (horizon/cap あり) の注意書きは引き続き有効。
