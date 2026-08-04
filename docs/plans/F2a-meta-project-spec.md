# F2a — `v1_project` テーブル設計 spec（wire 拡張パス採用時の deferred 計画）

## メタデータ

- **ID**: F2a
- **Phase**: 2 (deferred — user decision 待ち)
- **Target repo**: `tastile-core` (migration + handler + DDL) + `tastile-web` (wire 拡張)
- **Sub-project parent**: F (Meta Attrs)
- **Depends on**: A, G, H
- **Source spec**: `04-sub-projects/F-meta-attrs.md` §3 行 "Implement", §7 オープン質問 #1
- **Sibling plans**: F2b (`v1_tag` テーブル spec), F1a (project UI 除去), F1b (tags UI 除去)
- **Status**: **DRAFT — NOT IMPLEMENTED**. 本計画は user が「Implement (高コスト)」オプションを採用した場合にのみ着手する。今日の確定選択肢は F1a / F1b の Remove パス。

## 前提

- `tastile-core/v1/02-core-entities.md` の現行版には `Project` エンティティは存在しない（gap matrix 行 "Project / Tags (n/a)" 確認済み）。
- `tastile-core/v1/10-invariants.md` の不変条件群に Project は含まれない。Project を追加すると §10 の新規不変条件（"Project は必ず v1_subject に紐づく owner を持つ" 等）の追記が必要。
- `tastile-core/crates/v1/api/src/main.rs:258-710` に `/v1/projects` 系エンドポイントは存在しない。
- migration framework は `tastile-core/crates/v1/migrations/` 配下に `V1_NNN__name.sql` 形式で配置（CLAUDE.md 確認済み）。
- subject モデルは `access_repo::create_subject(kind=subject_kind::USER)` で確立済み（memory `project_repo_owner_user_is_dead_post_v1_004.md` 参照）。Project は subject の一種として扱うか、独立 entity として扱うか choice point。
- 採用判断は user の明示的承認待ち。本計画は「採用したらこうする」設計メモであり、実装は user の "Implement" 選択が出るまで凍結。

## 目的

将来 user が「Implement」オプションを選んだ場合に備え、`v1_project` テーブルの DDL / FK / ownership / マイグレーション SQL / API エンドポイント仕様 / wire 拡張ポイントを **設計 spec として** まとめておく。本計画は実装せず、設計判断ポイントと影響範囲の棚卸しに留める。

## 受入条件（本計画自体）

- 本計画は spec ドキュメントであり、コード変更・マイグレーション実行・API 実装は **しない**。受入条件は「user が Implement を選択したときに、本 spec を読み返せば実装に着手できる」こと。
- DDL は `tastile-core/crates/v1/migrations/V1_0XX__add_v1_project.sql` 形式でサンプル全文が含まれている（コメント付き、未適用）。
- 3 つの ownership model（per-user / per-org / per-subject）から推奨案が選ばれ、推奨理由が明記されている。
- FK 関係図（v1_project ↔ v1_tile ↔ v1_subject）が ASCII で示されている。
- wire 拡張ポイント（`quick-create-schedule-wire.ts:240-242` throw を silent drop に置換し、`meta.project` を payload に含める）が明記されている。

## 設計

### 3.1 ownership model 比較

| Model | Pros | Cons | Tastile 整合 |
|---|---|---|---|
| **per-user Project** | 各ユーザーが独立した Project 名空間 | Project 共有不可、組織利用不可 | §10 不変条件 "subject-bound" と整合（小規模 personal use 想定） |
| **per-org Project**（v1_org subject 必要） | 組織共有、Tastile desktop の enterprise 想定 | v1_org subject 実装が未着手（gap matrix 確認） | 過剰、将来 Phase |
| **per-subject Project** | Project も subject_kind=PROJECT として扱う | Project ↔ Tile 関係が N:M でなく 1:N 固定となり UI 上の "Project に複数 Tile" 表現が必要 | `access_repo::create_subject(kind=subject_kind::PROJECT)` で実装容易、§2 4 集約モデル拡張として最小コスト |

**推奨: per-subject Project**。理由:
1. 既存 `v1_subject` スキーマ（subject_kind smallint + owner_id uuid）の上に `subject_kind::PROJECT = 5` を 1 定数追加するだけで成立（memory `feedback_no_kind_enums.md` の数値定数-only ルールと整合）。
2. `access_repo::create_subject` を再利用でき、新規 CRUD 実装は Tile バインド部分のみで済む。
3. v1_org を将来追加するときに Project も subject に乗っていれば、grant モデル（access_repo の `grant_subject` パターン）と整合する。

### 3.2 DDL（per-subject Project 採用時）

```sql
-- V1_0XX__add_v1_project.sql (DRAFT — 未適用)

-- 1. v1_subject に subject_kind=PROJECT (=5) を許容するための定数追加
-- (subject_kind smallint の CHECK 制約は存在しないことを確認の上、必要なら DROP / ADD)
ALTER TABLE v1_subject DROP CONSTRAINT IF EXISTS v1_subject_kind_check;
ALTER TABLE v1_subject ADD CONSTRAINT v1_subject_kind_check
  CHECK (subject_kind BETWEEN 1 AND 10);  -- 1..4 既存、5=PROJECT、6..10 reserved

-- 2. v1_project テーブル本体
CREATE TABLE v1_project (
  id uuid PRIMARY KEY,                       -- = v1_subject.id (subject_kind=PROJECT)
  name text NOT NULL,                        -- 表示名（meta.project に渡される文字列）
  created_by_subject_id uuid NOT NULL,       -- Project を作成した user subject
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,              -- soft delete
  CONSTRAINT v1_project_id_fk FOREIGN KEY (id)
    REFERENCES v1_subject(id) ON DELETE CASCADE,
  CONSTRAINT v1_project_created_by_fk FOREIGN KEY (created_by_subject_id)
    REFERENCES v1_subject(id) ON DELETE RESTRICT
);

CREATE INDEX v1_project_name_idx ON v1_project (name) WHERE archived_at IS NULL;
CREATE INDEX v1_project_created_by_idx ON v1_project (created_by_subject_id);

-- 3. v1_tile ↔ v1_project 多対一（1 Tile に 1 Project / 1 Project に N Tile）
ALTER TABLE v1_tile ADD COLUMN v1_project_id uuid NULL;
ALTER TABLE v1_tile ADD CONSTRAINT v1_tile_project_fk FOREIGN KEY (v1_project_id)
  REFERENCES v1_project(id) ON DELETE SET NULL;

CREATE INDEX v1_tile_project_idx ON v1_tile (v1_project_id) WHERE v1_project_id IS NOT NULL;

-- 4. 不変条件コメント
COMMENT ON TABLE v1_project IS
  'Project aggregate root. id = v1_subject.id (subject_kind=PROJECT). '
  'Per-subject ownership model: any subject can create a Project; '
  'Tile assignment is via v1_tile.v1_project_id (nullable, SET NULL on project delete).';
```

### 3.3 FK 関係図

```
v1_subject (subject_kind=PROJECT = 5)
   │
   │  id (= v1_project.id, PK = FK)
   ▼
v1_project ◄──────── v1_tile.v1_project_id (nullable, SET NULL on delete)
   │
   │  created_by_subject_id (FK → v1_subject)
   ▼
v1_subject (subject_kind=USER)
```

### 3.4 API エンドポイント（core 側 handler 追加）

| Method | Path | Purpose |
|---|---|---|
| `POST /v1/projects` | 新規 Project 作成 | `name` + `created_by_subject_id`（header 由来 subject）→ 201 + `{id, name}` |
| `GET /v1/projects?owner=<subject_id>` | Project 一覧 | `WHERE created_by_subject_id = $1 AND archived_at IS NULL` |
| `GET /v1/projects/{id}` | Project 詳細 | name + archived + created_at |
| `PATCH /v1/projects/{id}` | Project 名前変更 / archive | name 変更は created_by のみ、archive は誰でも |
| `DELETE /v1/projects/{id}` | hard delete（cascade 設定次第） | 基本は `PATCH` の `archived_at = now()` を推奨 |

実装場所: `tastile-core/crates/v1/api/src/handlers/projects.rs`（新規）。`main.rs:258-710` の handler map に `POST/GET/PATCH/DELETE /v1/projects*` を追加。

### 3.5 wire 拡張ポイント

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の throw を silent drop に置換（コメントは「Project 永続化は `POST /v1/tiles/{tile_id}/project` で別途送る」旨を残す）。
- `meta.project: string | null` を payload に含める:
  ```ts
  payload.meta = { projectName: state.meta.project }
  ```
  （payload shape は core 側 `PublishScheduleDefinitionPayload` の拡張が必要、対応する V1 仕様書改訂と同期）
- F1a / F1b の Remove 適用時は本 wire 拡張ポイントは dead code となるため、Implement 採用時のみ activate。

### 3.6 採用判断マトリクス

| 判断ポイント | 採用案 | 採用理由 |
|---|---|---|
| ownership model | per-subject | 既存 subject_kind 拡張で済む、grant モデル整合 |
| Project = subject_kind 定数値 | 5 | 1..4 既存（USER=1, SESSION=2, …）、PROJECT=5、6..10 reserved |
| Tile ↔ Project カーディナリティ | N:1（1 Tile に 0..1 Project） | meta.project は optional、Project 削除時に SET NULL |
| hard delete vs soft archive | soft archive（`archived_at`）推奨 | 監査ログ・undo 容易、§10 不変条件と整合 |
| Project name 重複 | per-user 重複許容（同一 user 内で unique 制約なし） | 個人用途中心、過剰制約避ける |
| API 認証 | 既存の `handlers::common::authenticate`（subject_kind=USER 必須） | H §auth bridge と整合 |

## 検証手順（実装着手時）

この spec はまだ実装しないため検証手順は省略するが、実装着手時には以下を minimum gate とする:
- `cargo test --workspace` が green（既存 178 tests + 新規 Project CRUD tests）
- `wslc container exec tastile-db psql -f crates/v1/migrations/V1_0XX__add_v1_project.sql` 成功（forward migration）
- reverse migration（`V1_0XX__down.sql`）も作成し、`psql -f` で down → up サイクルが idempotent に実行できる
- wire 拡張後の Playwright e2e で、project name 入力 → submit → `SELECT v1_project_id FROM v1_tile` が non-null を確認
- subject_kind=PROJECT の境界テスト: `POST /v1/projects` が USER subject で叩かれると 201、`PATCH /v1/projects/{id}` が他 user の project id で叩かれると 403

## リスク

- **subject_kind 拡張の波及**: `subject_kind=5` を追加すると既存の CHECK 制約 / repository enum / wire type 全てへの波及確認が必要。`access_repo` 内の `subject_kind` マッチ式が exhaustive であるか rustc に警告させる（`#[non_exhaustive]` 属性の確認）。
- **wire payload schema breaking**: `PublishScheduleDefinitionPayload` に `meta.project` を加えると、既存 wire テストが失敗する。F1a Remove 適用済みの場合、本 wire 拡張は後方互換なしの変更（破壊的）。Implement 採用判断時に version bump（v1 → v2 など）の検討が必要。
- **gap matrix の "n/a" 解除の整合**: Project を実装すると gap matrix 行 "Project / Tags (n/a)" を "(implemented 2026-08-XX)" に更新する必要がある。`tile-create-e2e-wiring/03-gap-matrix.md` のメンテ責務を plan に明記。
- **本計画の凍結期間長期化**: user が Implement を選ばないまま 6 ヶ月経過すると、本 DDL は core の schema 進化（V1_030 以降）と衝突する可能性がある。再評価トリガーを `tile-create-e2e-wiring/05-impl-order.md` のリスクレビュー四半期毎に設定。
- **memory 整合**: 本 spec 採用時に memory `feedback_no_kind_enums.md` の「数値定数のみ」ルールと `subject_kind=5` の追加が矛盾しないか確認。`subject_kind` 自体が既に数値定数なので問題なし（kind enum 禁止は "kind=`'project'`" のような文字列リテラル禁止を意味する）。

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/F-meta-attrs.md` §3 (Implement 行), §7 オープン質問 #1
- **Sibling plans**:
  - `04-plans/F1a-meta-project-removal.md` (今日の確定選択肢: Remove)
  - `04-plans/F1b-meta-tags-removal.md` (今日の確定選択肢: Remove)
  - `04-plans/F2b-meta-tags-spec.md` (v1_tag 同等の spec)
- **Domain spec**: `tastile-core/v1/02-core-entities.md` (Project エンティティ追記先)
- **Invariants**: `tastile-core/v1/10-invariants.md` (Project 関連不変条件追記先)
- **API spec**: `tastile-core/v1/14-read-model-and-endpoint.md` (`/v1/projects*` エンドポイント追記先)
- **Handler 実装候補**: `tastile-core/crates/v1/api/src/handlers/projects.rs` (新規)
- **Subject model**: `tastile-core/crates/v1/access/src/repo_owner_user.rs` (廃止済 — memory `project_repo_owner_user_is_dead_post_v1_004.md`) / `access_repo::create_subject` パターン参照
- **Wire throw サイト**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242`
- **Memory anchors**:
  - `feedback_no_kind_enums.md` (subject_kind は数値定数のみ)
  - `project_repo_owner_user_is_dead_post_v1_004.md` (subject 生成は `access_repo::create_subject`)
  - `feedback_no_fragmented_reimplementations.md` (Project を subject の一種として実装し、再発明を避ける)
  - `feedback_verify_before_claiming_no_change.md` (DDL は trace してから「migration 不要」と主張する)
- **Out of scope (deferred until user decision)**:
  - 本 DDL のマイグレーション実行
  - core handler 実装
  - wire 拡張の activate
  - 採用判断が出なかった場合の四半期再評価トリガー設定

## 受入条件

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_

## 実装手順

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_

## 検証手順

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_
