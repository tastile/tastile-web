# F2b — `v1_tag` テーブル設計 spec（wire 拡張パス採用時の deferred 計画）

## メタデータ

- **ID**: F2b
- **Phase**: 2 (deferred — user decision 待ち)
- **Target repo**: `tastile-core` (migration + handler + DDL) + `tastile-web` (wire 拡張)
- **Sub-project parent**: F (Meta Attrs)
- **Depends on**: A, G, H
- **Source spec**: `04-sub-projects/F-meta-attrs.md` §3 行 "Implement", §7 オープン質問 #1
- **Sibling plans**: F2a (`v1_project` テーブル spec), F1a (project UI 除去), F1b (tags UI 除去)
- **Status**: **DRAFT — NOT IMPLEMENTED**. 本計画は user が「Implement (高コスト)」オプションを採用した場合にのみ着手する。今日の確定選択肢は F1a / F1b の Remove パス。

## 前提

- `tastile-core/v1/02-core-entities.md` の現行版には `Tag` エンティティは存在しない（gap matrix 行 "Project / Tags (n/a)" 確認済み）。
- `tastile-core/v1/10-invariants.md` の不変条件群に Tag は含まれない。Tag を追加すると §10 の新規不変条件（"Tag name は 1..64 文字の trimmed non-empty 文字列" 等）の追記が必要。
- `tastile-core/crates/v1/api/src/main.rs:258-710` に `/v1/tags` 系エンドポイントは存在しない。
- migration framework は `tastile-core/crates/v1/migrations/` 配下に `V1_NNN__name.sql` 形式で配置。
- F2a (Project) と異なり、Tag は **独立 subject_kind にする必然性がない**（tag は "label" であり aggregate root ではない）。よって独立テーブルとして設計。
- 採用判断は user の明示的承認待ち。本計画は「採用したらこうする」設計メモであり、実装は user の "Implement" 選択が出るまで凍結。

## 目的

将来 user が「Implement」オプションを選んだ場合に備え、`v1_tag` テーブルと `v1_tile_tag` 中間テーブルの DDL / FK / ownership / マイグレーション SQL / API エンドポイント仕様 / wire 拡張ポイントを **設計 spec として** まとめておく。本計画は実装せず、設計判断ポイントと影響範囲の棚卸しに留める。

## 受入条件（本計画自体）

- 本計画は spec ドキュメントであり、コード変更・マイグレーション実行・API 実装は **しない**。受入条件は「user が Implement を選択したときに、本 spec を読み返せば実装に着手できる」こと。
- DDL は `tastile-core/crates/v1/migrations/V1_0XX__add_v1_tag.sql` 形式でサンプル全文が含まれている（コメント付き、未適用）。
- 3 つの tag ownership model（per-user namespace / global namespace / per-subject namespace）から推奨案が選ばれ、推奨理由が明記されている。
- FK 関係図（v1_tag ↔ v1_tile ↔ v1_subject）が ASCII で示されている。
- wire 拡張ポイント（`quick-create-schedule-wire.ts:240-242` throw を silent drop に置換し、`meta.tags` を payload に含める）が明記されている。
- F2a (Project) との同時実装の整合性が明記されている（同一 PR に含めるか別 PR にするかの判断）。

## 設計

### 3.1 tag ownership model 比較

| Model | Pros | Cons | Tastile 整合 |
|---|---|---|---|
| **global namespace**（全 user 共有） | "work", "urgent" のような common tag を再利用、重複なし | 他 user の tag 名衝突、typo で他人の tag を選んでしまうリスク | §10 不変条件 "tag is a fact, not a label of one user" と整合 |
| **per-user namespace**（user 毎に独立 tag） | 他 user と衝突しない、private tag 表現容易 | 共通 tag の重複定義、search/recommend 困難 | 過剰、small-scale personal use 想定 |
| **per-subject namespace**（subject_kind=USER/DESKTOP/ANDROID 単位で独立） | 端末毎の tag 概念、組織 device 毎の独立 namespace | model 複雑、project との一貫性なし | 既存 subject モデルと整合するが tag の粒度として過剰 |

**推奨: global namespace + ownership column**。理由:
1. tag は "fact"（事実）であり、`v1_event` と同じく誰が作ったかを問わないラベルのほうが Tastile の design intent と整合（memory `feedback_no_kind_enums.md` の裏返し: tag は kind で識別する enum ではなく、name で識別する値）。
2. global に重複なし制約を課すことで、search / recommend / cross-user aggregation が将来容易（Phase 4 以降の analytics feature）。
3. ownership は "tag を作成した最初の user" を記録するカラムで保持（`created_by_subject_id`）。tag の rename / delete は admin ロール相当の操作（Phase 4+）。

### 3.2 DDL（global namespace + ownership column 採用時）

```sql
-- V1_0XX__add_v1_tag.sql (DRAFT — 未適用)

-- 1. v1_tag テーブル本体
CREATE TABLE v1_tag (
  id uuid PRIMARY KEY,                          -- gen_random_uuid() or uuidv7()
  name text NOT NULL,                           -- 表示名（meta.tags の要素、trimmed）
  name_normalized text NOT NULL,                -- lower(name) for unique constraint
  created_by_subject_id uuid NOT NULL,          -- tag を作成した最初の user subject
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,                 -- soft delete
  CONSTRAINT v1_tag_name_norm_unique UNIQUE (name_normalized) WHERE archived_at IS NULL,
  CONSTRAINT v1_tag_name_length_check CHECK (char_length(trim(name)) BETWEEN 1 AND 64),
  CONSTRAINT v1_tag_created_by_fk FOREIGN KEY (created_by_subject_id)
    REFERENCES v1_subject(id) ON DELETE RESTRICT
);

CREATE INDEX v1_tag_name_idx ON v1_tag (name) WHERE archived_at IS NULL;
CREATE INDEX v1_tag_created_by_idx ON v1_tag (created_by_subject_id);

-- 2. v1_tile ↔ v1_tag 多対多（中間テーブル）
CREATE TABLE v1_tile_tag (
  tile_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now(),
  attached_by_subject_id uuid NOT NULL,
  PRIMARY KEY (tile_id, tag_id),
  CONSTRAINT v1_tile_tag_tile_fk FOREIGN KEY (tile_id)
    REFERENCES v1_tile(id) ON DELETE CASCADE,
  CONSTRAINT v1_tile_tag_tag_fk FOREIGN KEY (tag_id)
    REFERENCES v1_tag(id) ON DELETE CASCADE,
  CONSTRAINT v1_tile_tag_attached_by_fk FOREIGN KEY (attached_by_subject_id)
    REFERENCES v1_subject(id) ON DELETE RESTRICT
);

CREATE INDEX v1_tile_tag_tag_idx ON v1_tile_tag (tag_id);  -- 逆引き（"この tag を持つ tile は？"）
CREATE INDEX v1_tile_tag_attached_by_idx ON v1_tile_tag (attached_by_subject_id);

-- 3. 不変条件コメント
COMMENT ON TABLE v1_tag IS
  'Tag label. Global namespace (name_normalized UNIQUE while not archived). '
  'Tile attachment is via v1_tile_tag (many-to-many, cascade on tile/tag delete).';
COMMENT ON TABLE v1_tile_tag IS
  'Many-to-many bridge between v1_tile and v1_tag. '
  'attached_by_subject_id records who attached this tag to this tile '
  '(may differ from v1_tag.created_by_subject_id — different users can attach same tag).';
```

### 3.3 FK 関係図

```
v1_tag
   │  id (PK)
   │  created_by_subject_id (FK → v1_subject)
   │  name_normalized (UNIQUE while not archived)
   ▼
v1_tile_tag (中間テーブル)
   │  tile_id (FK → v1_tile, CASCADE)
   │  tag_id  (FK → v1_tag,  CASCADE)
   │  attached_by_subject_id (FK → v1_subject)
   ▼
v1_tile
   ▲
   │  id (FK 逆参照)
v1_tile_tag
```

### 3.4 API エンドポイント（core 側 handler 追加）

| Method | Path | Purpose |
|---|---|---|
| `POST /v1/tags` | 新規 tag 作成 / upsert | `name` を受け、`name_normalized` 衝突時は既存 id を返す（idempotent）。`created_by_subject_id` は header 由来 subject |
| `GET /v1/tags?archived=false` | tag 一覧 | `archived_at IS NULL ORDER BY name` |
| `GET /v1/tags/{id}` | tag 詳細 | name + archived + created_at + created_by |
| `GET /v1/tiles/{tile_id}/tags` | tile に紐づく tag 一覧 | v1_tile_tag JOIN v1_tag |
| `POST /v1/tiles/{tile_id}/tags` | tile に tag 付与 | `tag_id` (or `tag_name`) → 201 |
| `DELETE /v1/tiles/{tile_id}/tags/{tag_id}` | tile から tag 剥奪 | 204 |
| `PATCH /v1/tags/{id}` | tag rename（admin only、Phase 4+） | rename は `name_normalized` 再計算 |
| `DELETE /v1/tags/{id}` | hard delete（admin only） | v1_tile_tag も CASCADE |

実装場所: `tastile-core/crates/v1/api/src/handlers/tags.rs`（新規）+ `tastile-core/crates/v1/api/src/handlers/tile_tags.rs`（新規）。`main.rs:258-710` の handler map に `/v1/tags*` および `/v1/tiles/{id}/tags*` を追加。

### 3.5 wire 拡張ポイント

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の throw を silent drop に置換（コメントは「Tag 永続化は `POST /v1/tiles/{tile_id}/tags` で別途送る」旨を残す）。
- `meta.tags: string[]` を payload に含める:
  ```ts
  payload.meta = { tagNames: state.meta.tags }
  ```
  （payload shape は core 側 `PublishScheduleDefinitionPayload` の拡張が必要）
- core 側は atomic publish 内で `name_normalized` 重複時は既存 tag を reuse する upsert 動作:
  ```rust
  for tag_name in payload.meta.tag_names.iter() {
      let tag_id = tag_repo::upsert_by_name(tag_name, subject_id)?;  // idempotent
      tile_tag_repo::attach(tile_id, tag_id, subject_id)?;
  }
  ```
- F1a / F1b の Remove 適用時は本 wire 拡張ポイントは dead code となるため、Implement 採用時のみ activate。

### 3.6 採用判断マトリクス

| 判断ポイント | 採用案 | 採用理由 |
|---|---|---|
| ownership model | global namespace + created_by column | search / recommend 容易、tag は fact として扱う design intent |
| name 制約 | char_length(trim(name)) BETWEEN 1 AND 64 | UI 過大入力防御、§10 不変条件 |
| name 正規化 | lower(name) で UNIQUE 制約 | "Work" と "work" を同一視、UX 改善 |
| 重複時の動作 | upsert（既存 tag を reuse） | idempotent、Phase 1 競合解決不要 |
| Tile ↔ Tag カーディナリティ | N:M（中間テーブル v1_tile_tag） | 複数 tag、複数 tile 双方サポート |
| hard delete vs soft archive | soft archive（v1_tag）、hard delete on tile/tag CASCADE | 監査容易 + 関連 tile 保護 |
| tag rename 権限 | admin only（Phase 4+） | 個人 rename は typo 修正困難、global 影響大 |
| Project 同時実装 | **同一 PR に含めることを推奨** | 両方 Meta Attrs の解決、テスト工数共有、gap matrix "n/a" → "implemented" 同時更新 |
| API 認証 | 既存の `handlers::common::authenticate`（subject_kind=USER 必須） | H §auth bridge と整合 |

### 3.7 F2a (Project) との同時実装

- **Project と Tag は別の集約**だが、source spec §1 の throw サイト `quick-create-schedule-wire.ts:240-242` は `project` と `tags` を同一 if 文で判定している。よって wire 拡張は両方を同時 activate する。
- マイグレーション: V1_0XX__add_v1_project.sql と V1_0XY__add_v1_tag.sql を **隣接する番号で発行**（transaction 内で適用する必要はないが、CI で連続適用される想定）。
- core handler: `handlers/projects.rs` と `handlers/tags.rs` を同 PR に含める。
- wire payload: `meta = { projectName: string|null, tagNames: string[] }` を `PublishScheduleDefinitionPayload` に追加。

## 検証手順（実装着手時）

この spec はまだ実装しないため検証手順は省略するが、実装着手時には以下を minimum gate とする:
- `cargo test --workspace` が green（既存 178 tests + 新規 Tag CRUD tests + Tile-Tag attach/detach tests）
- `wslc container exec tastile-db psql -f crates/v1/migrations/V1_0XY__add_v1_tag.sql` 成功
- reverse migration も作成し、down → up サイクルが idempotent に実行できる
- wire 拡張後の Playwright e2e で、tag 入力 → submit → `SELECT count(*) FROM v1_tile_tag WHERE tile_id = (SELECT id FROM v1_tile WHERE title=…)` が `len(meta.tags)` と一致
- name 正規化の境界テスト: `POST /v1/tags` を `"Work"` と `"work"` で 2 回叩くと 2 回目は既存 id を返す（201 でなく 200 or 同じ id）
- 重複 attach の境界テスト: `POST /v1/tiles/{id}/tags` を同じ `tag_id` で 2 回叩くと 2 回目は 409 Conflict または 204 No-Op のいずれかに決定
- CASCADE 動作テスト: `DELETE /v1/tags/{id}` で `v1_tile_tag` の該当行も消える

## リスク

- **global namespace の semantic 衝突**: "Work" を意図して tag 作成したら、別 user が "Work" を早就作成済みで意図せぬ tag に join するリスク。UI 側で autocomplete 候補を出す際、既存 tag 名を優先表示すれば回避可能だが、初回作成時の "あなたが始めて定義した Work" と "全 user 共通の Work" の区別が UX 課題。
- **subject_kind 拡張不要**: F2a (Project) と異なり、Tag は独立テーブルで subject_kind を拡張しない。よって `v1_subject` スキーマへの波及なし（§3.1 推奨案に基づく）。
- **wire payload schema breaking**: F2a と同じく、`PublishScheduleDefinitionPayload` 拡張は破壊的変更。version bump 検討必要。
- **中間テーブル v1_tile_tag の row 爆発**: tile 数 × tag 数の組み合わせで row が増える。1 tile に平均 5 tags × 10K tiles = 50K rows。PostgreSQL の index 性能上は問題なし（PK + 逆引き index のみ）。
- **name 正規化の locale 問題**: `lower()` は ICU collation を考慮しない。日本語 / 中国語の tag を同一視する必要がある場合は `unaccent()` + `lower()` 等の拡張が必要。MVP は ASCII 想定で `lower()` のみ。
- **memory 整合**: 本 spec 採用時に memory `feedback_no_kind_enums.md` の "tag は kind enum ではなく name で識別" の裏返しと整合（kind enum を禁止する memory が tag 自体の採用を妨げることはない）。
- **gap matrix 更新**: F2a と同時に "Project / Tags (n/a)" 行を "(implemented 2026-08-XX)" に更新。`tile-create-e2e-wiring/03-gap-matrix.md` のメンテ責務。
- **本計画の凍結期間長期化**: F2a と同じ。user が Implement を選ばないまま schema 進化すると番号衝突。

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/F-meta-attrs.md` §3 (Implement 行), §7 オープン質問 #1
- **Sibling plans**:
  - `04-plans/F1a-meta-project-removal.md` (今日の確定選択肢: Remove)
  - `04-plans/F1b-meta-tags-removal.md` (今日の確定選択肢: Remove)
  - `04-plans/F2a-meta-project-spec.md` (v1_project 同等の spec、同一 PR 推奨)
- **Domain spec**: `tastile-core/v1/02-core-entities.md` (Tag エンティティ追記先)
- **Invariants**: `tastile-core/v1/10-invariants.md` (Tag 関連不変条件追記先)
- **API spec**: `tastile-core/v1/14-read-model-and-endpoint.md` (`/v1/tags*` エンドポイント追記先)
- **Handler 実装候補**: `tastile-core/crates/v1/api/src/handlers/tags.rs` (新規) + `tastile-core/crates/v1/api/src/handlers/tile_tags.rs` (新規)
- **Wire throw サイト**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242`
- **Wire test**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts`
- **Memory anchors**:
  - `feedback_no_kind_enums.md` (tag は kind enum ではなく name で識別、subject_kind 拡張不要)
  - `feedback_no_fragmented_reimplementations.md` (tag を subject_kind にせず独立集約として実装)
  - `feedback_verify_before_claiming_no_change.md` (DDL は trace してから「migration 不要」と主張する)
  - `feedback_observe_actual_behavior.md` (tag upsert の idempotency は実 API を叩いて検証)
- **Out of scope (deferred until user decision)**:
  - 本 DDL のマイグレーション実行
  - core handler 実装
  - wire 拡張の activate
  - 採用判断が出なかった場合の四半期再評価トリガー設定
  - tag rename admin ロール（Phase 4+）

## 受入条件

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_

## 実装手順

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_

## 検証手順

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_
