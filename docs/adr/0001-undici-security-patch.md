# ADR web-0001: undici 7.29.1 security patch を固定する

Status: Accepted
Date: 2026-09-30
Scope: tastile-web dependency resolution
Issue: #181

## 根拠

2026-09-30 の current release gate は、jsdom / wrangler → miniflare が解決する undici 7.29.0 の9件の新規 advisoryで失敗した。公式 v7.29.1 と GHSA-w293-vg96-wgc3 は同majorの修正済み版を示す。

https://github.com/nodejs/undici/releases/tag/v7.29.1
https://github.com/advisories/GHSA-w293-vg96-wgc3

## 判断

Bun overrideでtransitive undiciを7.29.1へ固定し、lockfileの該当entryだけを更新する。direct toolchain / Next.js / app code は更新しない。新規audit ignoreを追加しない。既存Worker tooling例外のGHSA-3wwx-pv8p-q78vも修正版で解消するため、関連ignoreを撤去する。

7系のpatchを選ぶことでruntime/APIのmajor変更を避ける。上流が7.29.1以降へ固定しoverrideが不要になったら、次の依存更新で撤去を検討する。公開やdeployはこのpatchでは行わない。

## 検証

frozen install、production audit、通常Web gate、実PostgreSQL cli-auth gateを現在candidateで実行する。検証失敗時は意味変更やignoreで回避せず原因を修正する。
