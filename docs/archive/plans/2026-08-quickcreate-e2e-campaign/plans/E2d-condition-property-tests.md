# E2d — Condition AST ser/de round-trip property tests

## メタデータ

- **ID**: E2d
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + editors)
- **Depends on**: E2a (Condition AST serialiser + parser exist; see `plan-wire.ts:87-120` `convertCondition` / `convertTerm`)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §8 リスク — "Test matrix explodes combinatorially (operator × term × context). Recommend property-based tests for the AST ser/de round-trip."

## 前提

- `tastile-web/src/shared/api/v1/plan-wire.ts` exposes `convertCondition` (line 99) and `convertTerm` (line 125 area) — the "serialise" half of the round-trip
- E2a has landed `parseCondition` (or equivalent reverse helper) somewhere in the same file or a sibling in `src/shared/api/v1/`; the parser is what makes `parse(serialize(ast)) === ast` non-trivial — without it the test trivially passes on the identity
- `vitest ^4.1.10` is already in `tastile-web/package.json` devDependencies (per `pnpm ls vitest` / `package.json`); the test file should follow the same import pattern as `submit.test.ts:1` (`import { describe, expect, it } from "vitest"`)
- The `ConditionNode` / `Term` discriminated-union types live at `@/tile/model/v1/condition` (re-imported by `plan-wire.ts:33`); the generator must construct values whose type is the same shape the store emits
- The 6 term kinds per the parent spec (`v1/05:40-52`): Reference / Metric / Time / Task / Gap / Calendar. Note: `plan-wire.ts` currently maps to a 10-variant wire enum — for E2d the generator should cover at least the 6 store-side kinds, and assert parse of the wire form back to those 6 store kinds
- `bun test` is the canonical verification command for this repo (per root `CLAUDE.md` Workspace-wide policies); the test file is `.test.ts` so vitest's runner picks it up under `bun run test`

## 目的

Lock in a property-based guarantee that the Condition AST survives a serialize → parse round-trip with zero information loss, regardless of nesting depth or operator mix. The parent spec explicitly warns that the operator × term × context matrix is combinatorially explosive (§8 リスク) — hand-written fixtures cannot cover the space, and silent field drops in the wire builder are exactly the bug class that previously broke `recurring.condition` (parent §2). E2d makes that bug class unreproducible.

## 受入条件

- `tastile-web/src/shared/api/v1/condition.test.ts` exists and exports at least one `fc.assert` / `fc.prop` block with `numRuns >= 100`
- The arbitrary covers: operators `ALL` (kind 0) / `ANY` (kind 1) / `NOT` (kind 2) / `TERM` (kind 3) per `plan-wire.ts:99-118`, plus all 6 term kinds from `v1/05:40-52`
- Property `parse(serialize(ast))` is deep-equal (via `JSON.parse(JSON.stringify(...))` shape compare) to the original `ast` for every generated value
- `bun run test src/shared/api/v1/condition.test.ts` exits 0 and the vitest reporter prints `Test Files 1 passed (1)` / `Tests N passed (N)` with `N >= 100` (or shows the property run count)

## 実装手順

1. **Confirm `fast-check` is installed.** In `tastile-web/`:
   ```bash
   grep '"fast-check"' package.json || echo "MISSING"
   ```
   If missing, add it (devDependency, latest stable; `bun add -d fast-check`). See リスク.

2. **Locate the parser.** If E2a did not yet land a `parseCondition` / `parseTerm` function, this plan is blocked — file under §リスク and stop. Otherwise confirm the symbol path (expected: `./plan-wire` or a new `./condition` re-export):
   ```bash
   grep -nE "export (function|const) parse(Condition|Term)" src/shared/api/v1/plan-wire.ts
   ```

3. **Create `tastile-web/src/shared/api/v1/condition.test.ts`** with the following structure (line refs target the new file; pattern mirrors `submit.test.ts:1`):
   - **L1-L4** — imports:
     ```ts
     import { describe, expect, it } from "vitest";
     import * as fc from "fast-check";
     import { convertCondition, convertTerm } from "./plan-wire";
     import { parseCondition, parseTerm } from "./plan-wire"; // adjust if E2a put these elsewhere
     import type { ConditionNode, Term } from "@/tile/model/v1/condition";
     ```
   - **L6-L8** — `// 6 term-kind arbitrary: oneOf 6 leaf arbitraries (Reference/Metric/Time/Task/Gap/Calendar)`, each producing a well-typed object with required scalar fields filled (e.g. Reference → `{ kind: "reference", targetId: "<uuid>", quantifier: "first" }`)
   - **L10-L18** — `termArb: fc.Fc<Term> = fc.oneof(referenceArb, metricArb, timeArb, taskArb, gapArb, calendarArb)`. Use `fc.letrec` if the generator needs to be recursive (Term itself is not recursive, so a flat `fc.oneof` is sufficient)
   - **L20-L34** — `conditionArb = fc.letrec(tie => fc.oneof(...))`:
     - `termNodeArb = fc.record({ kind: fc.constant(3), term: termArb })` (maps to `convertCondition` kind 3 branch at `plan-wire.ts:115`)
     - `notNodeArb = fc.record({ kind: fc.constant(2), children: fc.array(tie("condition"), { minLength: 1, maxLength: 1 }) })` (NOT requires a single child per `plan-wire.ts:111-112`)
     - `allNodeArb = fc.record({ kind: fc.constant(0), children: fc.array(tie("condition"), { maxLength: 4 }) })`
     - `anyNodeArb = fc.record({ kind: fc.constant(1), children: fc.array(tie("condition"), { maxLength: 4 }) })`
     - depth cap is enforced by `fc.letrec`'s recursion budget (maxDepth ~3-4) — enough to exercise nesting, not so deep the parser blows the stack
   - **L36-L44** — main property:
     ```ts
     it("parse(serialize(ast)) deep-equals ast for every generated AST", () => {
       fc.assert(
         fc.property(conditionArb, (ast) => {
           const wire = convertCondition(ast);
           const back = parseCondition(wire);
           expect(JSON.parse(JSON.stringify(back))).toEqual(
             JSON.parse(JSON.stringify(ast)),
           );
         }),
         { numRuns: 100, endOnFailure: true, seed: 42, verbose: true },
       );
     });
     ```
   - **L46-L60** — second property for `Term` round-trip alone, using `convertTerm` (line 125 area) + `parseTerm`. Same `numRuns: 100`, independent seed. This isolates failures: if the Condition property fails, the Term property tells you whether the leaf or the operator is at fault
   - **L62-L70** — regression fixtures (3-5 hand-picked ASTs) under a separate `describe("hand-picked fixtures")` block. Use the canonical examples from `v1/05:11-32` (e.g. `{ALL: [timeReq, taskRef]}`, `{ANY: [metricLeq, calendarHoliday]}`, `{NOT: {taskRef}}`) — same assertion pattern, but no shrink — these catch obvious breaks even if the property generator has a coverage hole

4. **Export surface**: do NOT add the new arbitraries to `index.ts` — they are test-only, keep them sealed inside the `.test.ts` file. The G1a template's pattern is "verify the artifact", not "publish helpers".

5. **Run vitest's typecheck pass** to make sure `ConditionNode` / `Term` discriminants line up:
   ```bash
   cd tastile-web && bunx tsc --noEmit -p tsconfig.json
   ```
   (vitest's `expectTypeOf` is optional — only add if the parent E2a shapes are not exported.)

## 検証手順

```bash
# 1. fast-check is reachable
cd tastile-web
bun pm ls fast-check
# 期待: fast-check <version> present in devDependencies

# 2. File exists at the expected path
test -f src/shared/api/v1/condition.test.ts || echo "MISSING"
# 期待: 何も返らない (file present)

# 3. Run the property test in isolation
bun run test src/shared/api/v1/condition.test.ts
# 期待: vitest reporter shows
#   Test Files  1 passed (1)
#   Tests       N passed (N)   where N >= 100 (property) + ~10 (fixtures) + 1 (Term property) ≈ 110+
#   Duration    < 5s on warm cache

# 4. Re-run with a fixed seed to confirm shrink path
FAST_CHECK_SEED=42 bun run test src/shared/api/v1/condition.test.ts
# 期待: 同じ seed で 同じ pass カウント (proves deterministic, not flaky)

# 5. Confirm other v1 tests still green (no shared-helper regression)
bun run test src/shared/api/v1/
# 期待: 全 .test.ts が green, condition.test.ts が新規追加分として含まれる

# 6. CI parity: lint + typecheck
bun run lint src/shared/api/v1/condition.test.ts
bunx tsc --noEmit
# 期待: 0 errors
```

成功条件 (all must hold):
- (3) が 100 iterations すべて pass
- (4) の seed 固定でも pass カウント一致 (reproducibility)
- (5) の `src/shared/api/v1/` 配下に既存の test ファイルが red 化しない
- (6) で typecheck / lint 0 errors

## リスク

- **`fast-check` が deps に未登録** — 2026-08-03 時点で `package.json` に `fast-check` 行は存在しない (confirmed via `grep '"fast-check"' package.json`)。実装手順 1 で必ず追加すること。`bun add -d fast-check` で ~1MB dev-only 依存。CI cold cache への影響は秒単位
- **E2a が parser をまだ出荷していない** — 本 E2d は `parseCondition` / `parseTerm` の存在を前提とする。E2a 完了前に E2d だけ走らせると、parser が `JSON.parse(JSON.stringify(x))` の identity wrapper になり、テストは trivial pass する (false positive)。対策: E2a 着手証跡 (`git log --oneline -- src/shared/api/v1/plan-wire.ts` で parser-exporting commit) を確認してから E2d を開始する
- **discriminator drift** — `plan-wire.ts:115` の `kind === 3` branch (TERM) は `node.term` を `convertTerm` に通す。`convertTerm` 側の 6 kind 文字列 ("task" / "calendar" / 等) と `parseTerm` 側の逆マップが食い違うと property が赤くなる。これは E2d が拾うべきバグ (good failure mode) — 失敗時の fast-check 縮小出力 (shrunk counter-example) を issue に貼る
- **`fc.letrec` depth** — デフォルトの `maxDepth` を超えると AST が stack overflow することがある。`{ maxDepth: 4 }` 程度の明示指定で十分 (4 nested ALL/ANY で 256 末端、実用上必要十分)
- **JSON round-trip の落とし穴** — `BigInt` / `Date` / `Map` / `Set` を含めないこと。Condition AST は Rust `serde` 由来の素朴な discriminated union なので問題なし (構造は plain object + string/number/boolean のみ)。generator で `fc.date()` 等を使わないこと
- **vitest の `expect` が deep equal できるか** — vitest 4.x の `toEqual` は `JSON.parse(JSON.stringify(...))` 後の shape 比較で十分。`toStrictEqual` を併用すると `undefined` フィールド差分も拾うので、generator 側で `undefined` を生成しないよう注意 (e.g. optional field は `fc.option(...)` で wrap)

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` (§3 Condition AST editor, §8 リスク test matrix)
- Sibling plan: `tile-create-e2e-wiring/04-plans/E2a-condition-ast-serde.md` (parser 出荷元; 完了前提)
- Sibling plan: `tile-create-e2e-wiring/04-plans/E2b-condition-editor-ui.md` (UI 編集; 本 E2d は wire 層のみ)
- Domain spec: `tastile-core/v1/05-condition-completion-decision.md` line 11-32 (operator enum) / line 40-52 (term kinds)
- Domain code: `tastile-core/crates/v1/domain/src/condition.rs` (canonical shape — reference for arbitraries)
- Wire code: `tastile-web/src/shared/api/v1/plan-wire.ts:33,87-120` (`convertCondition` / `convertTerm`)
- Test pattern reference: `tastile-web/src/shared/api/v1/submit.test.ts:1,7` (vitest import + describe style)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
