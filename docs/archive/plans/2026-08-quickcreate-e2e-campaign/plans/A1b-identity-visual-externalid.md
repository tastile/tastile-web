# A1b — Identity visual fields + externalId

## メタデータ

- **ID**: A1b
- **Phase**: 1 (Tile identity)
- **Target repos**: `tastile-web`, `tastile-core`
- **Sub-project parent**: A (Tile + Plan + Meta minimum)
- **Depends on**: A1a、G1a/G1b、H 系 e2e harness
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-15` の対象フィールド 4〜6
- **Sibling plans**: A1a（kind/title/description）、A3a（owner bridge）

## 前提

- wire の現行実体は `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:342-348`。指定された `src/features/quick-create/wire/...` は現 HEAD に存在しない。
- `visual.color` は `quick-create-schedule-wire.ts:345`、`visual.icon` は `:346`、`externalId` は `:347` で payload の `color`、`icon`、`external_id` に写される。
- `externalId` は正本上 `String?` であり、core payload も `Option<String>`（`tastile-core/crates-v1/domain/src/command.rs:180-185`）。web は `QuickCreate.tsx:244-248` で UUIDv7 raw string を自動採番する。この「型は任意 String、producer は UUIDv7」という drift を validator で狭めない。
- active persistence は `tastile-core/crates-v1/storage/src/source_tile_repo.rs:407-410` の `v1_tile(color, icon, external_id)`。旧 migration の `visual_color/visual_icon`（`tastile-core/migrations/v1/V001__v1_tile.sql:18-20`）と、現 active schema の `color/icon` は名前が異なる。
- 現 HEAD で独立した icon registry は検出できない。default icon は `tastile-web/src/shared/stores/quick-create-store.ts:420` の enum-name-like string `check-circle` であり、同 test `quick-create-store.test.ts:20` が値を pin する。実装時に registry が追加済みならそこを正とするが、新 registry は本 plan で作らない。

## 目的

QuickCreate の `Tile.visual.color`、`Tile.visual.icon`、`Tile.externalId` が web payload から core の `v1_tile` まで文字列を変形せず保存されることを固定し、hex color、icon registry/name、UUIDv7 producer と `String?` domain contract の境界を明示する。

## 受入条件

- `visual.color`: `#3b82f6` のような hex string が `quick-create-schedule-wire.ts:345` を通り、active schema の `v1_tile.color` に同値で保存される。
- `visual.icon`: default の `check-circle`（または実装時点の正式 registry entry）が `quick-create-schedule-wire.ts:346` を通り、`v1_tile.icon` に同値で保存される。
- icon 値は自由入力ではなく既存 registry/選択肢の name であることを test で pin する。registry が存在しない現状では、default store test と e2e の exact string assertion を最小 contract とする。
- `externalId`: `QuickCreate.tsx:244-248` が作る UUIDv7 raw string を `quick-create-schedule-wire.ts:347` が無変換で送り、`v1_tile.external_id` に同値で保存する。
- `externalId` の core/domain 型を UUID に変更しない。`Option<String>` を維持し、「web producer の値が UUIDv7」という限定だけを test する。
- 実 DB e2e で title により対象を一意化し、visual と external id を同時に取得する。active schema が `color/icon` の場合はその列名を使い、旧 `visual_color/visual_icon` を盲目的に実行しない。

## 実装手順

1. **schema drift を観測する。** `source_tile_repo.rs:407-410` と `crates-v1/storage/migrations/V1_001__base.sql:47-59` を読み、実 DBで `\d v1_tile` を実行する。列が `color/icon/external_id` ならそれを e2e query に採用する。
2. **wire unit test を RED にする。** `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts` に `identity.visual.color="#3b82f6"`、`identity.visual.icon="check-circle"`、固定 UUIDv7 externalId を与え、`payload.tile` の 3 値が完全一致する test を追加する。
3. **externalId producer test を追加する。** `QuickCreate.tsx:244-248` を直接 component test しにくい場合は store/submit test で生成済み externalId を捕捉し、UUID version nibble が `7` であることと payload が raw string のままであることを assert する。domain type を UUID に狭める test は書かない。
4. **icon registry を再検索する。** 実装時点で registry がある場合、その exported entry に `check-circle` が含まれる test を追加する。無い場合は `quick-create-store.ts:420` と `quick-create-store.test.ts:20` を canonical default とし、単発用途の registry abstraction を新設しない。
5. **最小修正だけ行う。** `quick-create-schedule-wire.ts:345-347` が exact passthrough を満たさない場合のみ修正する。hex normalizer、icon mapper、UUID parser は要件外なので追加しない。
6. **e2e 入力/観測を追加する。** QuickCreate を開き title=`E2E smoke` で submit し、生成前後で browser 側 request payload または store から externalId を捕捉する。color/icon が UI で変更可能なら既存 control を操作し、そうでなければ default 値を assert する。
7. **実 DB assertion を追加する。** active schema では次を用いる。
   ```sql
   SELECT color, icon, external_id
   FROM v1_tile
   WHERE title = 'E2E smoke';
   ```
   ユーザー指定の旧 query `SELECT visual_color, visual_icon, external_id ...` は旧 migration schema 向けであるため、`\d v1_tile` がその列を示した場合だけ使う。
8. **値を比較する。** SQL row の color/icon が request/store と完全一致し、external_id が捕捉した UUIDv7 raw string と一致することを e2e helper で assert する。UUIDv7 は正規表現だけでなく version nibble も確認する。
9. **core regression を走らせる。** SourceTile persistence suite を wslc の実 PostgreSQL 上で実行し、`Option<String>` の null/non-null 双方に退行がないことを確認する。
10. **小さく commit する。** wire contract test/必要な最小修正と、実 DB e2e assertion を別 commit にする。実装時は `@test-driven-development`、実行時は `@executing-plans` を使う。

## 検証手順

```bash
# 1. web unit contract
cd tastile-web
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
bun test src/shared/stores/quick-create-store.test.ts
# 期待: color/icon/external_id exact passthrough、default icon pin が PASS

# 2. active schema 確認
wslc container exec tastile-db psql -U tastile -d tastile_db -c "\d v1_tile"
# 期待: active columns color, icon, external_id（実出力を証拠として保存）

# 3. browser + real DB e2e
cd tastile-web
bun run test:e2e quick-tile-create-e2e.spec.ts
# 期待: request/store と DB row が完全一致

# 4. active schema query
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT color,icon,external_id FROM v1_tile WHERE title='E2E smoke';"
# 期待: #3b82f6 | check-circle | <captured UUIDv7>

# 旧 schema が実 DB にある場合のみこちらを使用
# SELECT visual_color, visual_icon, external_id FROM v1_tile WHERE title='E2E smoke';
```

## リスク

- **列名 drift**: source spec の `visual_color/visual_icon` と active `source_tile_repo.rs:407-410` の `color/icon` が不一致。実 DB schema を確認せず e2e SQL を固定すると、wire ではなく列名エラーで落ちる。
- **externalId drift**: 正本/core は `String?`、web producer は UUIDv7。core を UUID 型へ変更すると import 等の将来 string ID を壊すため、本 plan は producer contract の test に限定する。
- **icon registry 不在**: 現 HEAD では registry を確認できない。`check-circle` は default name として test されているが、正式 registry validation と同義ではない。存在しない abstraction を発明しない。
- **hex validation 不在**: wire は文字列 passthrough。UI が hex 以外を生成しないことと core validation は別問題であり、本 plan で validator を追加しない。
- **自動生成 externalId の観測**: submit 成功後に store reset が走る（`QuickCreate.tsx:338-353`）ため、submit 前の request interception または store snapshot で値を捕捉する。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-15,54-58`
- Wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:342-348`
- externalId producer: `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:244-248`
- Defaults: `tastile-web/src/shared/stores/quick-create-store.ts:420`
- Default test: `tastile-web/src/shared/stores/quick-create-store.test.ts:20`
- Domain payload: `tastile-core/crates-v1/domain/src/command.rs:180-185`
- Persistence: `tastile-core/crates-v1/storage/src/source_tile_repo.rs:407-410`
- Legacy schema reference: `tastile-core/migrations/v1/V001__v1_tile.sql:11-20`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
