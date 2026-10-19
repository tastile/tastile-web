# D3a — FrameRule persistence E2E

## メタデータ

- **ID**: D3a
- **Phase**: 2 (persistence proof)
- **Target repo**: `tastile-web` / wslc 上の `tastile-core`
- **Sub-project parent**: D (frame-rules)
- **Depends on**: D1a、G1〜G8、H1〜H4、A/B/C の QuickCreate E2E 基盤
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/D-frame-rules.md:32-38`
- **Sibling plans**: D2a (ChangeSet/flow empty stub)、G7a (base QuickCreate E2E)

## 前提

- D1a が完了し、wire が FrameRule を payload に含め、core が `v1_frame_rule` に保存できる。
- `tastile-web/playwright.config.ts` の E2E bypass/auth/port 設定は G6a/G6b の成果物を使う。DB/API/web を同じ検証 stack に接続する。
- QuickCreate の §5 Recurring UI には FrameRule の入力 affordance が存在し、作成フォームから一件の daily rule を設定できる。
- e2e helper はテスト前後に v1 tables を隔離/cleanup する。`v1_frame_rule` が tile FK を持つ場合は child-first の cleanup 順序を使う。
- SQL assertion は Windows host の DB ではなく `wslc container exec tastile-db psql` で実行する。

## 目的

実ブラウザで QuickCreate を開き、単一の weekday FrameRule（毎日 09:00–17:00、Mon–Fri）を入力して submit し、返却された tile id に対して `v1_frame_rule` row の count と shape を SQL で確認する。UI success や API 200 だけでなく persistence の実証を残す。

## 受入条件

- Playwright test が QuickCreate を実際に開き、FrameRule input を一件設定し、submit を完了する。
- submit response または subsequent read model から新しい tile id を取得できる。
- 次の SQL が成功する。

```bash
wslc container exec tastile-db psql -U postgres -d tastile -c \
  "SELECT count(*) FROM v1_frame_rule WHERE tile_id = '<new-tile-id>';"
```

- count が `1`。
- 同じ tile の row で weekday mask が Mon–Fri、開始が 09:00、終了が 17:00 に対応する。保存形式が分単位/秒単位の場合は D1a の canonical schema に合わせて比較する。
- test run が exit code 0 で、`1 passed; 0 failed` の実行証拠と SQL 出力がログに残る。
- cleanup 後に frame-rule row が次のテストへ漏れない。

## 実装手順

1. `tastile-web/e2e/quick-tile-create-e2e.spec.ts` と `e2e/helpers/v1.ts` を読み、既存の QuickCreate open、owner、submit、tile-id取得、cleanup の idiom を特定する。既存 spec を無関係に書き換えず、専用 spec または同一 suite の一 test に限定する。
2. FrameRule fixture を定義する。意味上は `start=09:00`、`end=17:00`、`weekday_mask=Mon-Fri`、daily rule 一件とし、UI の実際の label/testid を source から確認して hard-coded guessed locator を避ける。
3. テスト前の cleanup に `v1_frame_rule` を追加する。FK が `v1_tile`/placement 等へ向く場合は既存 helper の transaction/順序に従い、テストが自分の row だけを数える状態を作る。
4. failing E2E test を書く。`page.getByRole`/`getByLabel`/stable testid で QuickCreate を開き、§5 の FrameRule affordance を一件埋め、submit を押す。まず D1a 未実装なら throw または row count 0 で失敗することを確認する。
5. submit の response、作成完了イベント、または既存の tile read endpoint から `<new-tile-id>` を取得し、test 内で保持する。tile id を UI 表示文字列から推測せず、ネットワーク response/fixture helper の canonical 値を使う。
6. SQL assertion helper を追加または既存 helper を拡張する。`wslc container exec tastile-db psql ... -tA -c` の出力を parse し、count と rule shape の expected 値を assert する。秘密値や DB password を spec に書かない。
7. Playwright の trace/screenshot は failure 時に残る既存設定を使い、成功時は最小ログとして tile id、count、shape を出力する。
8. test を単独で実行して green にし、続けて base QuickCreate E2E と対象 suite を実行して isolation/regression を確認する。

## 検証手順

先に stack と web を確認する。

```bash
curl -s http://127.0.0.1:31400/v1/health
wslc container ls --format "{{.Names}} {{.Status}}" | grep -E "tastile-db|tastile-v1-api|tastile-v1-worker"
```

期待値は health が ok、3 container が Up。

Playwright を実行する。

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:e2e -- e2e/<frame-rule-spec>.spec.ts
```

成功後、test が記録した tile id を使う。

```bash
wslc container exec tastile-db psql -U postgres -d tastile -tA -c \
  "SELECT count(*) FROM v1_frame_rule WHERE tile_id = '<new-tile-id>';"

wslc container exec tastile-db psql -U postgres -d tastile -tA -c \
  "SELECT weekday_mask, start_time, end_time FROM v1_frame_rule WHERE tile_id = '<new-tile-id>';"
```

期待出力は count `1` と、D1a で定義した canonical representation における Mon–Fri / 09:00 / 17:00。実行完了ログに `1 passed; 0 failed` が含まれることを確認する。SQL が skip された場合は成功扱いにせず、Postgres reachable になるまで再実行する。

## リスク

- **UI locator の変更**: `data-testid` または既存 accessibility label を優先し、翻訳文言だけに依存しない。見つからない場合は source の現行 DOM を更新してから test を直す。
- **API response に tile id がない**: 既存の create response contract または read endpoint を使い、DB の最新 row を時刻で推測しない。D1a の response DTO を先に確定する。
- **wslc から SQL が skip/接続失敗**: `psql` の exit code と実出力を必須にし、空結果を pass に変換しない。G2/G3 stack-up に戻る。
- **timezone/weekday bit ordering**: SQL assertion は D1a の registry/spec にある numeric mask と保存単位を参照する。Mon–Fri を単純な `31` と仮定しない。
- **test data leakage**: `v1_frame_rule` を child-first cleanup し、失敗時にも teardown が走る Playwright fixture を使う。既存ユーザーの rows は無条件 truncate しない構成なら owner/tile scope を併用する。
- **source spec の stale resolution**: D spec は旧案として frameRules demote を記載しているため、今回の D1a wire expansion とこの計画の SQL proof を優先し、実装時に旧記述を根拠として UI を削除しない。

## 関連

- `tile-create-e2e-wiring/04-sub-projects/D-frame-rules.md:32-38,40-50`
- `tastile-web/e2e/quick-tile-create-e2e.spec.ts`
- `tastile-web/e2e/helpers/v1.ts`
- `tastile-web/playwright.config.ts`
- `tastile-web/src/features/create-tile/ui/QuickCreate.tsx`
- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:249-257`
- `tile-create-e2e-wiring/04-plans/D1a-frame-rule-creation.md`
- `tile-create-e2e-wiring/04-plans/D2a-change-set-flow-throws.md`
- `tile-create-e2e-wiring/04-plans/G7a-e2e-run-quick-tile.md:24-38,73-128`
- `tile-create-e2e-wiring/05-impl-order.md:40-60`
- `tastile-core/v1/08-recurring-and-frame.md:47-103`
- `tastile-core/v1/10-database-schema.md`
- `tastile-core/crates-v1/domain/src/command.rs:178-340`
