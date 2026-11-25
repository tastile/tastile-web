# 00 — Overview: Tile Creation + Scheduled Placement E2E Wiring

## 目的 (Purpose)

`POST /v1/schedule-definitions` を tastile-web の QuickCreate パネルから叩いて、tastile-core が受け取って Postgres に永続化し、`GET /v1/timeline` で観測できる、という一気通貫の経路をローカル wslc スタック + Playwright e2e で証明する。デフォルト状態（identity / plan / time / windows / recurring core / source）で e2e グリーンを取り、サブプロジェクト単位で QuickCreate のカバレッジを拡張し、最終的に core のドメイン仕様 `tastile-core/v1/02` `v1/14` が要求する全フィールドを UI ＋ wire に反映する。

## スコープ境界 (Scope boundary)

**In scope**: QuickCreate の `quick-create-schedule-wire.ts` 経路、tastile-core の `crates-v1/api/src/main.rs` の write 系エンドポイント、wslc ローカルスタック、Playwright e2e の docker→wslc 置換、bridge auth アラインメント、`v1_tile` / `v1_plan` / `v1_placement` 永続化の検証。

**Out of scope**: core の他 152 エンドポイント（access/grants/events/notifications/owner profile/avatar/api-tokens/tick/quota 等）の網羅、Phase B/C/D の新機能仕様設計、Android の Web 構成パリティ。

## 受入条件 (Acceptance criteria)

- core v1 デーモンが wslc でローカル起動、`GET http://127.0.0.1:31400/v1/ready` が `{status:"ok",database:"ok",migration:"ok"}` を返す
- bridge auth ヘッダ 2 本（`x-tastile-web-bridge-secret` + `x-tastile-web-session-user`）で web から認証が通り、owner UUID が `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)` で core 側と一致する
- デフォルト状態 QuickCreate 提出で `v1_tile` / `v1_plan` / `v1_placement` 各テーブルに 1 行ずつ作成され、`SELECT count(*)` が期待値を満たす
- `GET /v1/timeline?from=…&to=…` が提出した placement を含む
- `tastile-web/e2e/quick-tile-create-e2e.spec.ts` がリアルスタックでグリーン（既存 docker→wslc 置換 + TRUNCATE に `v1_tile` / `v1_annotation` を追加）
- 各サブプロジェクト A〜F に固有の受入条件が `04-sub-projects/<id>-*.md` に明記されている

## サブプロジェクト一覧 (Sub-project index)

| ID | Title | Phase | Depends on | Output |
| --- | --- | --- | --- | --- |
| **G** | Stack up | 0 | — | wslc `tastile-pgdata` ボリューム + `tastile-db` / `tastile-api` / `tastile-worker` 起動、ヘルスチェック green |
| **H** | Auth bridge | 0 | G | web `.env.development` の `TASTILE_WEB_BRIDGE_SECRET` と `up-v1.sh` の `BRIDGE_SECRET` を一致させ、curl で 1 件作成成功 |
| **A** | Tile + Plan | 1 | G, H | identity.* + plan.{role,references,completion,planning,metrics,decisions} の e2e 検証、`v1_tile` / `v1_plan` 行作成 |
| **B** | Time + Windows | 1 | G, H | time.span / time.durationMinMax / windows[] の e2e 検証、`v1_placement.baseline` + `v1_window` 行作成 |
| **C** | Recurring + Source | 1 | G, H | recurring.repeatMode / weekdayMask / endDate / interval / life + source.{offset,excludedDates,preferredDuration,splitPolicy,priority,relations,flowSequences} の検証、`source_schedule.generation` 永続化 |
| **D** | Frame rules | 2 | A, G, H | recurring.frameRules / recurring.rules / advanced.changeSets / advanced.rules の wire 拡張または throw 除去 |
| **F** | Meta attrs | 2 | A, G, H | meta.project / meta.tags の wire 拡張または throw 除去 |
| **E** | Condition tree | 3 | A, C, G, H | recurring.condition（silent drop）+ plan.planning.flows（throw）+ Plan.completion.condition AST エディタのフル実装 |

## 依存関係グラフ (Dependency graph)

```
G ──► H ──┬──► A ──┬──► D
          │        └──► F
          ├──► B
          └──► C ──────► E
```

- Phase 0（G + H）: ローカルスタックと認証の土台。実 DB に書き始める前の前提。
- Phase 1（A + B + C）: 既存の ✓ フィールド群を 3 つの並列サブプロジェクトで e2e 化。互いに独立。
- Phase 2（D + F）: 既存の throw サイトの解決。A が終わっていれば独立に着手可能。
- Phase 3（E）: Condition AST は他のフィールドを参照するため Phase 1/2 完了が前提。

## 次のステップ (Next step)

`01-domain-spec-fields.md`（Side A: core ドメイン仕様の全フィールド列挙）のエージェント完了を待ち、続けて `02-ui-coverage-audit.md` と `03-gap-matrix.md` を作成、それから各サブプロジェクトファイルを並行で書き起こす。