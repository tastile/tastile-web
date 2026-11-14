# G4 follow-up (web#219) item E — v2 候補 vs Core v1 materialization 照合

`scripts/v2-v1-occurrence-diff.ts` が、同一 QuickCreate state から

1. `deriveV2SchedulerInput` → `evaluateSchedulerV2` (実 `tastile-v2` binary) で v2 候補を取得
2. `buildQuickCreateSchedulePayload` → `POST /v1/schedule-definitions` で実 v1 submit
3. `GET /v1/source-tiles/{id}` を poll し、occurrence / placement の materialization 完了を待ってから
4. v2 occurrence `[start,end]` と v1 **placement** `[start,end]` を同一の評価 range・UTC instant で比較

した結果。各 case は fresh owner で実行 (source 間の placement 競合を排除)。
実行環境: host dev server (:3124) + isolated Core (:31400) + 実 PostgreSQL、
通常 Better Auth session (bridge header 認証)。

## 結果 (summary.json)

| case | v2 candidates | v1 placements (in range) | exact span | v2-only | v1-only | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| daily-basic | 14 | 14 | 14 | 0 | 0 | **完全一致** |
| weekly-mask-30m | 667 | 100 | 100 | 567 | 0 | weekday_mask 未反映 |
| monthly-by-day-15 | 14 | 14 | 14 | 0 | 0 | v1 が monthly_rule を無視し daily 配置 |
| interval-12h | 28 | 26 | 26 | 2 | 0 | ほぼ一致 (range 端の materialization horizon 差) |
| daily-excluded | 14 | 12 | 12 | 2 | 0 | excluded_dates 未反映 |

## 確認された乖離 (v2 preview が v1 より多く/違う候補を出す)

1. **weekly `weekday_mask`**: v2 input に mask 概念がなく、mask で除外される曜日
   (今回 567 件 = 土日) も候補として表示される。v1 placement は全て v2 start と
   exact 一致するため、差分は「v2 が superset を出す」だけ。
2. **`excluded_dates`**: v2 input に除外日がなく、除外日に候補が残る (2 件)。
3. **monthly**: v1 wire は `monthly_rule` を送るが **Core の
   `SourceScheduleDefinition` に対応 field が存在せず**、実 placement は daily
   に materialize される (by_day=15 を指定しても連日 placement、59/59 件確認)。
   v2 preview (daily step) は v1 の実挙動とは一致するが、**ユーザーの
   monthly 意図とは一致しない** — これは v1 側の未実装であり v2 の責任ではない。
4. **materialization cap/horizon**: weekly 30min interval は v2=667 候補に対し
   v1 occurrence が 100 件で頭打ち (materialization 上限)。interval-12h でも
   v1 は v2 range 末尾 2 件を materialize しない。v2 候補数は「作られる予定数」
   の上限ではない。

## 一致が確認されたもの

- daily / interval: occurrence start・span ともに **delta 0ms で完全一致**
  (window bounds なしケース)。v2 occurrence `[s,e]` は v1 placement `[start,end]`
  と同じ意味論。
- 非同期 materialization: occurrence 生成 → placement 充填は worker tick で遅延
  するため、本 script は occurrence/placement/in-range count が連続 stable に
  なるまで poll する。「未生成 (pending)」と「不一致」を分離して記録。

## item D への示唆 (実装済み判断は別 commit)

- weekly mask / excluded_dates は **client-side post-filter で近似可能**
  (v2 は superset を返すため、authored mask/excluded で preview を絞れば
  v1 generation と同じ候補集合に近づく)。契約変更不要。
- monthly は v1 が monthly_rule を未実装のため「v2 が不正確」ではなく
  「v1 がユーザー意図を実現していない」。UI では monthly 選択時に
  daily materialization である旨を明示するのが誠実。
- v2 候補数 ≠ 最終予定数 (cap/horizon あり) を UI 文言で維持。
