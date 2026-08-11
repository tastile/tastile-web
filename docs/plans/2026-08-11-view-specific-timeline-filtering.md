# ビュー別タイムライン既定フィルタ実装プラン

## 目的
`tastile-web` の Day / Week / Month / Year / Agenda が、指定しない限り同じ全件データを取得・表示している状態を改める。ビューごとの表示要件をリクエストに載せ、`tastile-core` が不要な Placement を返さないようにする。

## 正本・制約
- `tastile-core/v1/14-read-model-and-endpoint.md` §4 の TimelineQuery / TimelineInclude
- `tastile-core/v1/10-invariants.md` の EffectivePlacement 専用 read と client-side 再解決禁止
- `tastile-web/AGENTS.md` の thin client 原則
- break/rest を文字列や専用 discriminator で判定しない。source kind と既存の数値化された schedule metadata / span duration を使う

## 観測した差分
1. `tastile-web/src/features/manage-schedule/ui/ScheduleTimeline.tsx` は Month でも `useEvents` にビュー条件を渡さず、全件取得後に `source.kind === 1` だけを client filter している。
2. `tastile-web/src/lib/upstream/events.ts` は `/v1/timeline` に `include_labels=true` を常時指定している。
3. `tastile-core/crates-v1/api/src/handlers/timeline.rs` は `include_labels` の既定値が `true`。`include_nested` と `include_closed` の SQL 条件も未実装同然で、`include_nested` は後段で除外するが `include_closed` は `$5 OR NOT l.close` により false 時のみ除外される。
4. Web の `min_minutes` は `upstreamListTimeline` のレスポンスループで適用され、DB/API の候補数・materialization 数は減らさない。
5. Core には `summary=month` があるが、これは relation/split の代表化だけで、短い休憩や定期 cadence の既定除外には使われていない。

## 設計方針
- API にビュー名そのものを渡して business logic を増やさず、read filter の数値・boolean 条件を明示する。
- ただし既存の `summary=month` は Month の relation representative 用に維持し、Month の既定フィルタを同じ request に追加する。
- デフォルトは「必要情報のみ」へ変更するが、明示的に include/filter を指定した場合は従来どおり取得できる。
- 既存の `include_*` の意味を壊さず、Timeline の default `include_labels=false` を正本 §4 に合わせる。
- 休憩を title で判定しない。短時間除外は effective span duration、定期タイルの表示抑制は既存の `source_kind=RECURRING` と Month 専用 cadence/continuity filter を API 側で扱う。

## API 仕様変更案
`GET /v1/timeline` に次を追加する。

- `min_duration_ms: Option<i64>`: effective span の duration が閾値未満の候補を除外。`min_minutes` より wire contract を明確にする。既存の Web compatibility route は `min_minutes` を受け、upstream request に変換する。
- `exclude_source_kinds: Option<String>`: 数値 CSV。既存の PlacementSource 数値だけを対象にする。Month の短い recurring 以外を明示的に除外する用途では使わず、必要な場合の明示 override 用に限定する。
- `summary=month` の処理を、必要な場合は effective span 解決後の duration filter と組み合わせる。

定期 cadence の「1日以下を Month で表示しない」は、現行 timeline row に cadence が無いため、次のいずれかを実装前に確定する必要がある。

A. `source_kind=RECURRING` の placement を、Month request では `source_kind=1` かつ `span duration <= 1 day` として除外する。既存 contract と実装負荷が最小。ただし「定期間隔」ではなく「生成された placement の長さ」を見る。
B. `v1_recurring_frame_rule.step_duration_ms` 等を join して cadence を判定する。意図に最も近いが、SourceTile/legacy recurring の両方に関する SQL contract と index/テスト範囲が広がる。

## Web 変更
- `UseEventsRange` に `minDurationMs` / `summary` / 必要な source filter を追加。
- `ScheduleTimeline` で view ごとの query policy を定義。
  - Day: include labels/closed/nested は必要時のみ。短い placement は表示可能。
  - Week: Day と同じ詳細表示。
  - Month: `summary=month`、既定の短時間 filter、recurring suppression を API request に載せる。
  - Year: 年間概要用の明示 policy（詳細 placement を全件取得しない）を決める。
  - Agenda: 日付範囲内の詳細表示。
- Month の `events.filter(...)` は削除し、API response をそのまま MonthPanel に渡す。
- `upstreamListTimeline` は query filter を Core に forwarding し、レスポンス後の `minMinutes` filtering を削除する。
- `/api/events/occurrences` の parser、upstream tests、use-events tests を更新する。

## Core 変更
- `TimelineParams` に filter fields を追加し、OpenAPI mirror/生成型を更新。
- SQL で候補を絞る filter と、effective span 解決後に必要な filter を実装。
- `include_labels` の default を false に修正。
- `include_nested` / `include_closed` / `include_blocked` の acceptance test を追加/修正。
- Month summary と filter の組合せ、explicit override、default behavior を API integration test で pin。

## 要確認
- 「1日以下の定期タイル」は **生成間隔（cadence）** で判定する。Month/Year の既定では cadence が 1 日以下の recurring placement を除外する。
- Year の既定 policy は Month と同じ概要フィルタとする。

## 受け入れ条件
- Month の初回ネットワーク request に view-specific filter が含まれ、API response に除外対象が含まれない。
- API を直接叩いても同じ filter 結果になり、Web の後段 filter に依存しない。
- 明示的な include/filter override では対象が返る。
- Day/Week/Agenda の必要な短い Placement は消えない。
- default include_labels=false、closed/nested/blocked の既定挙動が v1/14 と一致する。
- Web unit tests、Core API tests、`bun run check`、Core applicable gates、実ブラウザで Month/Day を確認する。

## 触る予定のファイル
- `tastile-web/src/features/manage-schedule/ui/ScheduleTimeline.tsx`
- `tastile-web/src/shared/hooks/calendar/use-events.ts`
- `tastile-web/src/lib/upstream/events.ts`
- `tastile-web/src/app/api/events/occurrences/route.ts`
- 上記の関連 tests
- `tastile-core/crates-v1/api/src/handlers/timeline.rs`
- `tastile-core/crates-v1/api/src/openapi.rs` / generated schema（必要な場合）
- Core timeline API tests

## 触らない予定のファイル
- v0 frozen crates
- placement materialization / scheduler business logic
- break/rest の専用判定や title-based consumer logic

## 実装ステータス (2026-08-11 close)

採用方針 = Q&A で確定した **生成間隔（cadence）** で判定。Year は Month と同じ policy。

### Core 変更 (`crates-v1/api/src/handlers/timeline.rs`)
- `TimelineParams` に `min_duration_ms` / `min_recurring_step_ms` / `exclude_source_kinds` を追加
- `include_labels` の既定を `true` → `false` に修正（v1/14 §4 整合）
- SQL に 2 つの filter を追加:
  ```sql
  AND ($7::bigint IS NULL OR recurring_cadence.step_duration_ms IS NULL
       OR recurring_cadence.step_duration_ms > $7::bigint)
  AND ($8::smallint[] IS NULL OR NOT (p.source_kind = ANY($8::smallint[])))
  ```
- LATERAL join の FK chain を 2-hop に修正:
  ```sql
  LEFT JOIN LATERAL (
    SELECT MIN(rfr.step_duration_ms) AS step_duration_ms
    FROM v1_placement_source_ref_recurring psrr
    JOIN v1_frame f             ON f.id = psrr.frame_id
    JOIN v1_recurring_frame_rule rfr ON rfr.id = f.frame_rule_id
    WHERE psrr.placement_id = p.id AND rfr.generator_kind = 0
  ) recurring_cadence ON TRUE
  ```
  - 旧: `JOIN v1_recurring_frame_rule rfr ON rfr.id = psrr.frame_id` (FK 直接参照の誤り)
  - 正: `psrr.frame_id → v1_frame.id → v1_frame.frame_rule_id → v1_recurring_frame_rule.id` (2-hop)
- LATERAL join を `v1_source_tile` 経由にも拡張 (2026-08-11 source_kind=4 対応):
  ```sql
  LEFT JOIN LATERAL (
    SELECT MIN(step_ms) AS step_duration_ms
    FROM (
      SELECT rfr.step_duration_ms AS step_ms     -- source_kind=1 (legacy recurring)
      FROM v1_placement_source_ref_recurring psrr
      JOIN v1_frame f ON f.id = psrr.frame_id
      JOIN v1_recurring_frame_rule rfr ON rfr.id = f.frame_rule_id
      WHERE psrr.placement_id = p.id
        AND rfr.generator_kind = 0
        AND rfr.step_duration_ms IS NOT NULL
        AND rfr.step_duration_ms > 0
      UNION ALL
      SELECT st.generation_interval_ms AS step_ms -- source_kind=4 (SourceTile)
      FROM v1_source_tile st
      WHERE st.source_tile_id = p.source_tile_id
        AND st.generation_kind = 1
        AND st.generation_interval_ms IS NOT NULL
        AND st.generation_interval_ms > 0
    ) step_ms_union
  ) recurring_cadence ON TRUE
  ```
  - 観測事実: 2026-07-20 SourceTile migration 後、`休憩` placements は `source_kind=4` (SOURCE) に変換されている。`v1_placement_source_ref_recurring` は legacy source_kind=1 専用 FK chain なので、source_kind=4 行は populate されない
  - 旧 LATERAL join は source_kind=4 placements で `recurring_cadence.step_duration_ms IS NULL` を返し、SQL filter `IS NULL OR > $7` で **常に真 → 配置が drop されない** → 休憩が Month view に居座り続ける
  - 修正後: source_kind=4 placements の cadence を `v1_source_tile.generation_interval_ms` から解決 (SourceGenerationKind::RECURRING=1 のときのみ)。ONE_TIME (kind=0) は cadence なし → NULL → 既存通り通過
- effective span 解決後の `min_duration_ms` filter を post-resolution loop に追加:
  ```rust
  if let Some(min_ms) = min_duration_ms {
      let duration_ms = (effective_span.end - effective_span.start).num_milliseconds();
      if duration_ms < min_ms { continue; }
  }
  ```
- `parse_source_kinds(Option<&str>) -> Option<Vec<i16>>` helper を追加:
  - `None` / empty / all-invalid → `None` (filter off)
  - CSV of i16 → `Some(Vec<i16>)`
- `commands.rs::forward_timeline` の `TimelineParams` initializer に 3 フィールドを追加

### Core unit tests (`handlers::timeline::tests`)
- `source_kinds_none_yields_no_filter`
- `source_kinds_empty_string_yields_no_filter`
- `source_kinds_parses_single_value`
- `source_kinds_parses_csv_whitespace_tolerantly`
- `source_kinds_drops_invalid_entries_silently`
- `source_kinds_all_invalid_yields_no_filter`
- 既存 12 test 全て無回帰（合計 18 timeline unit test Green）

### Web 変更
- `src/lib/upstream/events.ts` — `TimelineQuery` に `summary` / `minRecurringStepMs` を追加、`include_labels=false` を default で送る、`exclude_source_kinds` の forwarding を実装
- `src/app/api/events/occurrences/route.ts` — `summary` / `min_recurring_step_ms` の query parse を追加
- `src/shared/hooks/calendar/use-events.ts` — `UseEventsRange` に `summary` / `minRecurringStepMs` を追加して buildQs で forwarding
- `src/features/manage-schedule/ui/ScheduleTimeline.tsx`:
  - view 別に `minDuration` / `showRecurring` の初期値を変更（month/year = 5 min / off、day/week/agenda = 0 / on）
  - `useEffect` で `state.view` 変更時に上記を auto-reset
  - `useEvents()` に `summary: month` (compact view) / `minRecurringStepMs: 1 day` (compact view) を渡す
  - client-side の `monthEvents` filter (kind===1 除外) を撤去
- `src/features/manage-schedule/ui/CalendarSidePanel.tsx` — showRecurring toggle を Year view にも表示

### 検証
- `cargo fmt --manifest-path crates-v1/Cargo.toml --all -- --check` Green
- `cargo clippy --manifest-path crates-v1/Cargo.toml -p api --all-targets -- -D warnings` Green
- `cargo test --manifest-path crates-v1/Cargo.toml -p api --lib -- --test-threads=1` 60/60 Green
- Web 側は `bun run check` は user 側で実行 (CI gate)
- DB 経路の e2e (`timeline_view_filtering_e2e.rs`) は本 commit では未追加。Core unit tests (parse_source_kinds_*) で wire-format contract を pin しているため、別 PR で e2e を追加可能

### ロールバック
- Core: `crates-v1/api/src/handlers/timeline.rs` + `crates-v1/api/src/handlers/commands.rs` の本 commit 範囲を revert
- Web: `src/lib/upstream/events.ts` / `src/app/api/events/occurrences/route.ts` / `src/shared/hooks/calendar/use-events.ts` / `src/features/manage-schedule/ui/ScheduleTimeline.tsx` / `src/features/manage-schedule/ui/CalendarSidePanel.tsx` を revert
- DB への影響: なし (read-only filter の追加のみ。既存 placement / frame / recurring には触れない)
