# A1a — Identity core fields

## メタデータ

- **ID**: A1a
- **Phase**: 1 (Tile identity)
- **Target repos**: `tastile-web`, `tastile-core`
- **Sub-project parent**: A (Tile + Plan + Meta minimum)
- **Depends on**: G1a/G1b（wslc image build/verify）、H 系 e2e auth harness
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-15` の対象フィールド 1〜3
- **Sibling plans**: A1b（visual/externalId）、A3a（owner bridge）

## 前提

- 現行リポジトリ配置は旧参照から移動している。wire の実体は `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:327-348`、core API handler は `tastile-core/crates-v1/api/src/handlers/commands.rs:87-107` にある。
- 指定された `tastile-web/src/features/quick-create/...` と `tastile-core/crates/v1/...` は現 HEAD には存在しないため、実装時は上記 `src/shared` / `crates-v1` を正とする。
- `IdentitySection.tsx` は現 HEAD に存在しない。Identity UI は `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:181-193,244-248,445-472` に統合されており、タイトル入力は `:451-472`、kind は見出し分岐 `:185-194` と store state、description は専用入力が見当たらない。実装前にこの差分を再確認する。
- wire は `title` と `description` を `quick-create-schedule-wire.ts:343-344` で `tile` payload に載せる。一方 `kind` は `:343-347` に明示されず、SourceTile 作成経路で core が `v1_tile.kind=3` を固定する（`tastile-core/crates-v1/storage/src/source_tile_repo.rs:407-410`）。元 spec の「`:347` implied」は現実装とずれている。
- domain payload の consumer は `tastile-core/crates-v1/domain/src/command.rs:180-185,198-210`。旧指定の `crates/v1/api/src/commands.rs:112` に相当する API entry は `crates-v1/api/src/handlers/commands.rs:87-107`。
- `v1/02-domain-model.md:30-40` の旧ファイル名は現 HEAD に存在しない。正本は `tastile-core/v1/02-core-entities.md` の Tile 節である。

## 目的

QuickCreate の `Tile.kind`、`Tile.content.title`、`Tile.content.description` がフォーム/store → wire payload → core SourceTile consumer → PostgreSQL `v1_tile` まで欠落・置換なしで到達することを、unit contract と実 DB e2e の両方で固定する。

## 受入条件

- `kind`: default QuickCreate submission が `v1_tile.kind = 3`（`TileKind.SOURCE`）として保存される。UI の `identity.kind` をそのまま wire するという誤った期待は置かず、現 SourceTile API の固定値 contract を明文化する。
- `title`: 前後空白を除いた `identity.title` が `quick-create-schedule-wire.ts:343` を通り、`v1_tile.title` に `E2E smoke` として保存される。
- `description`: `identity.description` があれば優先し、なければ `meta.memo`、両方空なら `NULL` となる `quick-create-schedule-wire.ts:344` の precedence を unit test で固定する。
- 実 DB e2e で `SELECT kind, title, description FROM v1_tile WHERE title='E2E smoke'` が期待する 1 行を返す。
- 「コードを読んだ」だけで PASS とせず、到達可能な PostgreSQL を使った e2e の実行結果を記録する。

## 実装手順

1. **現行パスを再確認する。** `quick-create-schedule-wire.ts:327-348`、`QuickCreate.tsx:181-193,244-248,445-472`、`commands.rs:87-107`、`command.rs:180-210`、`source_tile_repo.rs:407-410` を読み、旧 file:line 指定との差分を plan 実行ログに残す。
2. **wire unit test を先に RED にする。** `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts` の既存 payload test に、`title="  E2E smoke  "`、`description="identity description"`、`meta.memo="memo fallback"` を与え、`payload.tile.title === "E2E smoke"` と `payload.tile.description === "identity description"` を assert する。
3. **description fallback test を追加する。** 同 test で `identity.description=null`（型が空文字なら `""`）の場合に `payload.tile.description === "memo fallback"`、両方空の場合に `null` を期待する。まず現挙動と期待差があれば failing evidence を保存する。
4. **最小修正のみ行う。** `quick-create-schedule-wire.ts:343-344` が test を満たさない場合だけ修正する。既に満たす場合は production code を変更せず test の追加に閉じる。
5. **フォーム経路を固定する。** `QuickCreate.tsx:451-472` の title input を既存 component test/e2e から操作する。description の専用 control が本当に無い場合は、A1a の e2e で利用する最小の既存入力（meta memo）を明記し、IdentitySection を新造しない。専用 description UI の追加は別 UI plan とする。
6. **e2e を RED にする。** `tastile-web/e2e/quick-tile-create-e2e.spec.ts`（存在しなければ現行 QuickCreate spec を検索し、そのファイルのみ編集）に、title と description/memo を入力して submit した後、実 DB query を行う sub-step を追加する。
7. **DB assertion を追加する。** e2e helper から次を実行し、row count 1 と値を検査する。
   ```sql
   SELECT kind, title, description
   FROM v1_tile
   WHERE title = 'E2E smoke';
   ```
   Expected: `kind=3`, `title='E2E smoke'`, `description=<入力値>`。現 schema の列名は `tastile-core/crates-v1/storage/migrations/V1_001__base.sql:47-59` と `source_tile_repo.rs:407-410` を最終確認する。
8. **core consumer の回帰を確認する。** `source_tile_repo.rs:407-410` が `payload.tile.{title,description}` を bind し、kind を `3` に固定していることを integration test または既存 SourceTile suite で exercise する。新しい DB migration は作らない。
9. **小さく commit する。** wire unit test/必要な最小修正と、e2e DB assertion を別 commit に分ける。実装時は `@test-driven-development`、実行時は `@executing-plans` を使う。

## 検証手順

```bash
# 1. web wire unit contract
cd tastile-web
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
# 期待: title trim / description precedence の全 test PASS

# 2. core SourceTile persistence regression（wslc 内で実行）
cd tastile-core
cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_source_tile_scheduling -- --test-threads=1
# 期待: test result: ok; 0 failed

# 3. real browser + real PostgreSQL e2e
cd tastile-web
bun run test:e2e quick-tile-create-e2e.spec.ts
# 期待: submit HTTP success、DB query が kind=3/title/description の 1 行を確認

# 4. 最終 SQL（wslc stack の DB 名・user は G/H plan に合わせる）
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT kind,title,description FROM v1_tile WHERE title='E2E smoke';"
# 期待: 3 | E2E smoke | <入力した description>
```

## リスク

- **kind の仕様誤読**: `quick-create-schedule-wire.ts:347` は `external_id` であり kind ではない。SourceTile route は `source_tile_repo.rs:407` で kind=3 を保存するため、identity.kind の round-trip と書くと偽の contract になる。
- **旧 file:line drift**: `IdentitySection.tsx`、`crates/v1/api/src/commands.rs`、`v1/02-domain-model.md` は現 HEAD にない。古いパスを新規作成して帳尻を合わせない。
- **description fallback**: `identity.description ?? meta.memo` は空文字を fallback させない。store 型/初期値を確認し、期待値を無断変更しない。
- **DB column drift**: 旧 migration `migrations/v1/V001__v1_tile.sql:16-20` は `content_title/content_note/visual_*` だが active schema/repo は `title/description/color/icon`。実 DBの active migrationを正とする。
- **e2e skip**: DB 未到達で skip する helperでは完了扱いにしない。実 SQL の返却行を証拠に残す。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-15,24-33`
- Wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:327-348`
- Form: `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:181-193,244-248,445-472`
- API consumer: `tastile-core/crates-v1/api/src/handlers/commands.rs:87-107`
- Domain payload: `tastile-core/crates-v1/domain/src/command.rs:180-210`
- Persistence: `tastile-core/crates-v1/storage/src/source_tile_repo.rs:407-410`
- Canonical model: `tastile-core/v1/02-core-entities.md` Tile / SourceTile 節
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
