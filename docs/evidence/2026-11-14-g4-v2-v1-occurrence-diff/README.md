# G4 follow-up (web#219) item E — v2 候補 vs Core v1 materialization 照合

`baseline/` の計測は **旧 contract** (Core が monthly_rule / kind=3 を
未実装だった時期、OpenAPI submodule v1.0.x 系) での結果。web#228
(`release-1-1-0` に merge 済み) で monthly recurrence が実装され、
OpenAPI は v3.1.0 → 本 PR で **v3.2.0** (submodule `9ae5874`) に更新
されたため、script は以下のように更新済み:

- `source.schedule.generation` の **read-back** を記録し、Core が
  authored semantics (kind / monthly_rule / weekday_mask /
  excluded_dates / date_range) を実際に保存したかを検証する
  (OpenAPI v3.2.0 `SourceTileRead.schedule`)。
- diff を 2 軸で分類する:
  - **cause**: `none` / `v2_input_gap` (③ anonymization 相当:
    v2 eval port が authored semantics を表現できない情報損失) /
    `v1_period_boundary` / `suspected_regression` (②) /
    `nondeterminism` (④: 同一 input の v2 再評価で候補が変わる場合に
    自動で上書き) / `pending`。① intended safety fix は Core が意図的に
    乖離する場合 (例: 過去 anchor の clamp) 用に予約。
  - **semantics**: `monthly_rule` / `weekday_mask` / `excluded_dates` /
    `period_boundary` — どの authored rule が乖離を形作るかを
    v2-only 行ごとに `explainedBy` タグで記録。
- v2 eval を **2 回実行**して determinism を確認 (④)。
- summary.json / 各 case に `candidateNote` を常時出力し、
  「v2 occurrence は advisory candidate であり materialized placement
  ではない」ことを証跡上も明示。

## baseline 計測 (旧 contract、再計測待ち)

`baseline/` は PR 初版 (`ca8d9426` 時点、release-1-1-0 の monthly fix
前) の実測値。monthly case の「Core 未実装」記述は **もう当てはまらない**。

| case | v2 candidates | v1 placements (in range) | exact span | v2-only | v1-only | 当時の判定 |
| --- | --- | --- | --- | --- | --- | --- |
| daily-basic | 14 | 14 | 14 | 0 | 0 | 完全一致 |
| weekly-mask-30m | 667 | 100 | 100 | 567 | 0 | weekday_mask 未反映 |
| monthly-by-day-15 | 14 | 14 | 14 | 0 | 0 | v1 が monthly_rule を無視し daily 配置 (→ 現在は kind=3 で実装済み) |
| interval-12h | 28 | 26 | 26 | 2 | 0 | v1 horizon が range 末尾を materialize しない |
| daily-excluded | 14 | 12 | 12 | 2 | 0 | excluded_dates 未反映 |

## 現行 contract で予想される分類 (要再計測)

- **monthly-by-day-15**: v1 は kind=3 + monthly_rule で 15 日のみに
  materialize する。v2 は依然 daily step 近似のため、15 日以外の
  candidate が v2-only として大量に出る → `cause=v2_input_gap`,
  `semantics=monthly_rule`。Core が monthly_rule を read-back できれば
  `generationReadBack.monthlyRule` に値が残る (残らなければ
  `coreRegression`)。
- **weekly-mask-30m**: `semantics=weekday_mask` (土日の v2-only 行が
  `explainedBy=["weekday_mask"]` になるはず)。v1 の 100 件頭打ちは
  materialization cap で `period_boundary` 相当。
- **daily-excluded**: `semantics=excluded_dates`。
- **interval-12h / daily-basic**: `cause=none` または
  `v1_period_boundary` (horizon 端の v2-only)。

## 実行方法 (変更なし)

```bash
source /tmp/t13-web-env.sh   # WEB/CORE/BRIDGE + TASTILE_V2_CLI/STORE/LOCK
bun scripts/v2-v1-occurrence-diff.ts [--out <dir>] [--cases a,b]
```

前提: v2 `tastile-v2` CLI + seed 済み store/lock (`scripts/v2-seed-store.sh`)、
writable な isolated Core + 它を向く Next.js dev server、実 PostgreSQL。
v2 toolchain が無い環境では全 case が `skipped: v2 adapter not configured`
になるだけで、v1 submit は走らない (安全側)。

## item D への示唆 (baseline 時点の記録、要再検証)

- weekly mask / excluded_dates は v2 input の表現不足であり、
  client-side post-filter で近似可能 (契約変更不要)。
- monthly は web#228 で v1 が kind=3 を submit するようになったため、
  残る乖離は **v2 preview 側の daily-step 近似**のみ。v2 port に
  monthly selector を足すか、preview 文言で近似である旨を明示するかは
  別 issue の判断。
- v2 候補数 ≠ 最終予定数 (cap/horizon あり) を UI 文言で維持 —
  `V2ScheduleEval` の hint/「候補」表記は現行でも candidate と
  placement を混同させない。
