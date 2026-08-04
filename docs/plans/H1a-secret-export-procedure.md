# H1a — Manual bridge secret export

## メタデータ

- **ID**: H1a
- **Phase**: 1 (auth bridge alignment)
- **Target repos**: `tastile-core`, `tastile-web`
- **Sub-project parent**: H (auth-bridge)
- **Depends on**: G (stack-up) — wslc stack が起動済みで `tastile-api` コンテナに env を渡せる状態
- **Source spec**: `04-sub-projects/H-auth-bridge.md` §"Fix options" Option A
- **Sibling plans**: H1c (bridge secret validation), H3a (bridge auth curl verify), H4a (bridge mode flag flip)

## 前提

- `tastile-web/.env.development:26` に `TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-...` が存在 (source spec H-auth-bridge.md §"Mismatch diagnosis")
- `tastile-core/scripts/wslc/up-v1.sh:17` は `BRIDGE_SECRET="${TASTILE_WEB_BRIDGE_SECRET:-wslc-dev-bridge-secret}"` で **環境変数が渡されればそのまま採用** し、無ければ `wslc-dev-bridge-secret` に落ちる (default)
- WSL 上の wslc バイナリが PATH にあり、`tastile-v1-api` イメージが存在 (G1a 完了前提)
- 本手順は **dev-only の manual export**。`.env.shared` 等の構造的同期 (Option B/C) は別 plan。本格的な構造 sync は sub-project G 側で secrets 共有が要る段階で着手

## 目的

`up-v1.sh:17` の default `wslc-dev-bridge-secret` は `tastile-web/.env.development:26` の real secret `E5SzuyY3s8Sz0-...` と一致しない (source spec §"Mismatch diagnosis")。両者が不一致のまま `E2E_BYPASS_AUTH=0` に flip すると、`bridge_auth_from_headers` (`crates-v1/api/src/handlers/common.rs:810`) が literal string compare で 401 を返す。本プランは **`up-v1.sh` を起動する前に 1 行だけ export** することでこの不一致を dev 環境で吸収する (Option A)。

## 受入条件

- `wslc container exec tastile-v1-api printenv | grep BRIDGE_SECRET` が `.env.development:26` の値と **完全一致** する 64-char 文字列を返す
- `curl -H "x-tastile-web-bridge-secret: $BRIDGE_SECRET" -H "x-tastile-web-session-user: e2e-bypass" http://127.0.0.1:31400/v1/health` が **HTTP 200** を返す
- 上記 curl の `$BRIDGE_SECRET` を **意図的に 1 文字改竄** すると HTTP 401 が返る (literal compare contract の pin)
- `wslc container rm -f tastile-api && wslc container run ...` で再起動した後も env が保持される

## 実装手順

### Step 1: 作業ディレクトリを `tastile-core` へ移動

`up-v1.sh` は `$REPO_ROOT` を起点に `cd` するため (line 20)、実行前に `tastile-core` 直下に居る必要がある。`relative path` で `../tastile-web/.env.development` を参照するため `tastile-core` が起点。

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-core
# 確認
test -f scripts/wslc/up-v1.sh || echo "MISSING up-v1.sh"
```

### Step 2: secret を export する 1 行

```bash
export BRIDGE_SECRET=$(grep TASTILE_WEB_BRIDGE_SECRET ../tastile-web/.env.development | cut -d= -f2)
```

- `grep TASTILE_WEB_BRIDGE_SECRET ../tastile-web/.env.development` で line 26 を 1 行抽出
- `cut -d= -f2` で `=` より右側 (= value 部分) のみ取り出す
- line 26 が `# TASTILE_WEB_BRIDGE_SECRET=...` でコメントアウトされていれば空文字が export される。事前に `cat ../tastile-web/.env.development | sed -n '26p'` で確認推奨

### Step 3: export 結果の目視確認

```bash
echo "${BRIDGE_SECRET:0:8}...${BRIDGE_SECRET: -8}  length=${#BRIDGE_SECRET}"
# 期待: "E5SzuyY3...gtsiDpjX    length=64"
# `E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` = 64 chars
```

### Step 4: `up-v1.sh` を起動

```bash
bash scripts/wslc/up-v1.sh
# 期待出力: "==> Stack up. Endpoints: API health: curl -s http://127.0.0.1:31400/v1/health"
```

`up-v1.sh:66` で `-e TASTILE_WEB_BRIDGE_SECRET="$BRIDGE_SECRET"` が api container に渡る。export が漏れた場合 `-e TASTILE_WEB_BRIDGE_SECRET="wslc-dev-bridge-secret"` (default) で起動してしまい、本プランの受入条件は満たない。

### Step 5: api container 内の env 確認

```bash
wslc container exec tastile-v1-api printenv | grep -E "TASTILE_WEB_BRIDGE_SECRET|BRIDGE_SECRET"
```

注: wslc はコンテナ名解決に `tastile-v1-api` を使うが、`up-v1.sh:59` の `--name tastile-api` で起動した場合は `tastile-api` を使う。step 4 の出力末尾で実コンテナ名を確認すること。

## 検証手順

### Verify 1: api container 内の env が web `.env.development:26` と一致

```bash
# host 側の値
EXPECTED=$(grep TASTILE_WEB_BRIDGE_SECRET ../tastile-web/.env.development | cut -d= -f2)
# api container 内の値
ACTUAL=$(wslc container exec tastile-api printenv TASTILE_WEB_BRIDGE_SECRET | tr -d '\r')
# 比較
test "$EXPECTED" = "$ACTUAL" && echo "MATCH" || echo "MISMATCH"
# 期待: "MATCH"
```

### Verify 2: bridge auth header で `/v1/health` が 200

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "x-tastile-web-bridge-secret: $BRIDGE_SECRET" \
  -H "x-tastile-web-session-user: e2e-bypass" \
  http://127.0.0.1:31400/v1/health
# 期待: "200"
```

### Verify 3: 1 文字改竄で 401 (literal compare pin)

```bash
TAMPERED="${BRIDGE_SECRET:0:5}X${BRIDGE_SECRET:6}"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "x-tastile-web-bridge-secret: $TAMPERED" \
  -H "x-tastile-web-session-user: e2e-bypass" \
  http://127.0.0.1:31400/v1/health
# 期待: "401"
```

### Verify 4: wslc container 再起動後も env 保持

```bash
wslc container rm -f tastile-api
bash scripts/wslc/up-v1.sh
wslc container exec tastile-api printenv TASTILE_WEB_BRIDGE_SECRET
# 期待: 64-char secret がそのまま返る (export が漏れていなければ)
```

### Verify 5: bridge header 不在で `/v1/health` を確認 (x-owner-id / bridge とも無し)

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:31400/v1/health
# 期待: "401" または "200" (endpoint 仕様による。/v1/health は認証不要の可能性あり。200 の場合、ヘッダ無しでも通る contract を確認)
```

注: `/v1/health` は認証不要 endpoint の可能性が高い。bridge auth の contract を pin したい場合は `/v1/active-tile` 等 read エンドポイントを使う。

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "x-tastile-web-bridge-secret: $BRIDGE_SECRET" \
  -H "x-tastile-web-session-user: e2e-bypass" \
  http://127.0.0.1:31400/v1/active-tile
# 期待: "200"
```

## リスク

- **export 漏れ**: `up-v1.sh` 起動前に `export BRIDGE_SECRET=...` を忘れると default `wslc-dev-bridge-secret` で api が起動し、後続の bridge mode 検証 (H4a 等) で 401 になる。**Verify 1 で即座に MATCH を pin** することで漏れを検出できる
- **secret 露出**: `TASTILE_WEB_BRIDGE_SECRET` は `tastile-web/.env.development:26` に literal で書かれており、git tracked。本番 secret ではないことを確認するため `E5SzuyY3s8Sz0-...` prefix が **dev 用に発行された値** であることを HARNESS.md §Cross-package で再確認すること。本番 AWS の値が混入していた場合は `git filter-repo` で履歴削除 + 再発行が必要
- **他 terminal session からの export 漏れ**: `export` は current shell に閉じる。並列 terminal で別 shell から `up-v1.sh` を呼ぶと env が伝わらない。`scripts/wslc/up-v1.sh` 冒頭に `if [ -z "${BRIDGE_SECRET:-}" ]; then echo "BRIDGE_SECRET not set, falling back to default" >&2; fi` の **警告ログ** を 1 行追加する改善余地あり (本 PR のスコープ外、source spec §"Fix options" Option C で対応予定)
- **secret rotation**: 本手順は literal compare (`common.rs:810`) に依存しており、`.env.development:26` を rotate したら本手順も再実行が必要。CI / 本番 deploy では systemd `EnvironmentFile=/etc/tastile/tastile.env` で担保されている
- **PowerShell から `.env.development` を読むときの encoding**: Git Bash (MSYS) で `.env.development` を読む場合、BOM 無し UTF-8 なら問題ないが、Windows PowerShell から `Get-Content` 経由で読むと末尾に `\r` が残る可能性。`tr -d '\r'` で除去推奨 (Verify 1 で実施済)

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §"Auth contract" + §"Mismatch diagnosis" + §"Fix options"
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Bridge auth header spec: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §"Bridge header spec"
- Option B (`.env.shared` 共有): source spec §"Fix options" — 構造 sync が必要な段階で着手
- Option C (`up-v1-bridged.sh` ラッパ): source spec §"Fix options" — 同上
- H1c (bridge secret validation) — env injection 経路の検証
- H3a (bridge auth curl verify) — 4 種の header 組合せでの contract pin
- H4a (E2E_BYPASS_AUTH=0 flag flip) — 本手順で env 同期を済ませた上で flag flip
- wslc Container 設計: `tastile-root/docs/HARNESS.md` §"WSLC Container"
