# E2a — Condition AST TypeScript 型

## メタデータ

- **ID**: E2a
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`
- **Sub-project parent**: E
- **Depends on**: A, C, G, H; E1b
- **Source spec**: `tastile-core/v1/05-condition-and-reference.md`
- **Sibling plans**: E3b, E3c, E6a, E6b

## 前提

- Condition wire shape は `quick-create-schedule-wire.ts:20-24` の externally tagged `{All|Any|Not|Term: ...}` である。
- ドメイン上の Condition は 4 combinator（ALL / ANY / NONE / NOT）と Term の union で、`01-domain-spec-fields.md:60-65` に要約されている。
- Rust の discriminant と TypeScript の値は `tastile-core/v1/05-condition-and-reference.md` および `tastile-core/crates-v1/domain/src/condition.rs` を照合し、推測で増減させない。
- 10 Term kinds は core spec の最新版を source of truth とする。`E-condition-tree.md:18-24` の旧要約（6 kinds）をそのまま採用しない。

## 目的

Plan.completion.root と将来の FrameRule.active の双方で再利用できる、Rust enum discriminant に一致した Condition / Term / Combinator の型と最小限の型ガードを `tastile-web` に定義する。

## 受入条件

- `Combinator` は `ALL`, `ANY`, `NONE`, `NOT` の 4 値だけを許可する。
- `Term` は core spec の 10 kind を discriminated union として表し、各 kind の payload field 名・primitive 型・nullable 性が Rust/spec と一致する。
- `Condition` は combinator node と term node を再帰的に表現できる。
- `JSON.stringify` 用の変換で unsupported kind を silently drop しない。型ガードまたは runtime validation が失敗する。
- completion root の既存 payload 型（`schedule-definition.ts:57-184`）と互換で、既存の default submit が壊れない。
- 型テストまたは compile check が成功する。

## 実装手順

1. `tastile-core/v1/05-condition-and-reference.md` と `tastile-core/crates-v1/domain/src/condition.rs` の enum variant、field、discriminant を抽出し、計 10 Term kinds の対応表を plan 実行前に作る。
2. `tastile-web/src/shared/api/v1/` または既存 domain 型配置を確認し、Condition 型の canonical file を決める。既存 `ConditionNode` があれば二重定義せず置換または re-export 方針にする。
3. `Combinator` literal union と、`Term` の 10 variant discriminated union を定義する。Rust の externally tagged JSON shape をコメントと型で明示する。
4. `Condition` recursive union（`All`／`Any`／`None`／`Not`／`Term`）を定義し、必要なら Term kind 判定用の type guard を追加する。
5. 既存 store／wire 型の import を canonical 型へ寄せる。serializer で入力を省略する fallback は作らない。
6. invalid combinator、invalid term kind、欠落 payload の compile-time／runtime test を追加する。
7. `bun` の typecheck と対象テストを実行し、変更ファイルを plan の対象に限定する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun test -- <condition-types-test-file>
```

期待値は typecheck 成功、10 Term kinds の各 fixture が受理され、4 combinator の round-trip が同一 shape を返すこと。Rust enum と TypeScript の対応表はレビュー時に `v1/05` と `condition.rs` の file:line を再確認する。実行結果なしに PASS と報告しない。

## リスク

- Spec と Rust の variant 名が異なる可能性があるため、TypeScript の見た目を優先せず wire serializer の実装形を優先する。
- 既存 `ConditionNode` と新型の二重化は assignability の破綻を起こす。canonical 型を一つにする。
- `NONE` と `NOT` を混同すると core が受理しない。両者の arity を spec／Rust で確認する。

## 関連

- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/05-condition-and-reference.md`
- `C:/Users/rebui/Desktop/tastile/tastile-core/crates-v1/domain/src/condition.rs`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/01-domain-spec-fields.md:60-65`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:90-131`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:18-24,51-55`
- `C:/Users/rebui/Desktop/tastile/tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:20-24,213-450`
