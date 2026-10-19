# E3c — TimeRequirement round-trip e2e

## メタデータ

- **ID**: E3c
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`
- **Sub-project parent**: E
- **Depends on**: E2a, E3b, G, H, A
- **Source spec**: `04-sub-projects/E-condition-tree.md:38-43`
- **Sibling plans**: E6b

## 前提

- QuickCreate の create submit は `shared/api/v1/submit.ts:47` → `quick-create-schedule-wire.ts:213` → `POST /v1/schedule-definitions` の経路である（`02-ui-coverage-audit.md:4-26`）。
- e2e は Docker 前提を使わず、G の wslc stack と H の bridge auth を使う。既存 helper の Docker TRUNCATE は `02-ui-coverage-audit.md:159-170` に記録された移行対象である。
- ユーザー指定の DB assertion は `v1_plan.completion->>'timeRequirements'`。実 DB の列名・JSON shape は migration／read model を確認してから固定する。

## 目的

QuickCreate で TimeRequirement を入力して submit した値が、core の atomic schedule publish を経て `v1_plan.completion` に保存されることを実スタックで証明する。

## 受入条件

- Playwright が QuickCreate を開き、TimeRequirement を少なくとも 1 件入力できる。
- submit が 2xx で完了し、作成された tile／plan ID を特定できる。
- DB の対象 plan で `completion->>'timeRequirements'` に入力した min/max/kind が含まれる。
- 同じ作成結果を API の read endpoint（timeline または plan/editable の既存 read model）でも確認できる。
- test setup/teardown は wslc Postgres に対して実行され、Docker container 名に依存しない。

## 実装手順

1. `tastile-web/e2e/quick-tile-create-e2e.spec.ts` と `e2e/helpers/v1.ts` の fixture、auth、DB helper、truncate 契約を読む（`02-ui-coverage-audit.md:159-170`）。
2. `e2e/time-requirement-editor.spec.ts` を作り、既存の QuickCreate open／fill／submit helper を再利用する。新しい認証 bypass や DB client は作らない。
3. CompletionSubPanel の label/test id を使って `minMinutes=45`, `maxMinutes=90`, `kind=DURATION` のような固定 fixture を入力する。実装上の accessible name を優先し、脆い CSS selector は避ける。
4. submit response から plan ID を取得する。response に ID がない場合は既存 read model と title／owner の一意条件で直後の row を特定し、曖昧検索を避ける。
5. wslc Postgres の既存接続手順で `v1_plan` を query し、`completion->>'timeRequirements'` を JSON として parse して field 単位で assertion する。
6. test teardown を既存 `truncateV1` 契約に接続し、`v1_tile`／`v1_plan` の FK 順序と annotation を含む cleanup を G plan の手順に従わせる。
7. real stack で対象 spec を実行し、skip された場合は成功扱いにしない。Postgres の接続と `test result` の実出力を記録する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bunx playwright test e2e/time-requirement-editor.spec.ts --workers=1
```

期待値は実 DB に接続した上で test passed。補助確認は wslc Postgres の psql で対象 plan の JSON を取得し、`timeRequirements` の中に fixture の 45、90、`DURATION` が存在すること。接続不能による skip は受入未達とする。

## リスク

- JSON key が camelCase／snake_case で異なる可能性がある。DB assertion は実 migration と wire contract (`02-ui-coverage-audit.md:115-122`) に合わせる。
- DB JSON query を web host の Windows shell から実行すると quoting が壊れやすい。G の wslc helper／script を使う。
- UI の locator が label 変更で壊れる。accessible role/name または明示 test id を使う。

## 関連

- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:38-43`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:4-26,115-128,159-170`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/01-domain-spec-fields.md:39-48,131-149`
- `C:/Users/rebui/Desktop/tastile/tastile-web/e2e/`
- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/13-completion.md:49-93`

## 補足

Plan 実装時に DB の実列名または response contract が指定 assertion と違うことが判明したら、推測で assertion を緩めず、spec／migration に基づく canonical path を記録してから修正する。
