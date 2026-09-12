---
name: i18n-literal-guard
description: tastile-web の policy §11 (i18n hardcoded literal) 違反を release 前 / bump 直前に read-only で検出する。JSX / doc-comment / identifier の CJK literal を分類し、移送判断は人間 / agent に委ねる。
---

# i18n-literal-guard (canonical)

## scope

`tastile-web` 専用。workspace 共通の canonical は存在しない (web-local 拡張)。

## 入出力

- 入力: `git diff --stat HEAD~1 HEAD` の path 集合、または明示指定 path 群。
- 出力: `docs/journal/<env>/<date>.jsonl` に append する journal エントリ (read-only
  scan — ファイルを変更しない)。

## 検出対象

1. JSX text node に CJK literal を含む (`>ここが CJK<` のような形)。
2. JSX attribute に CJK literal (`title="説明"`)。
3. doc-comment (`/** ... */` / `// ...`) に CJK literal。コメントの説明文は許容、ただし
   "TODO:" / "FIXME:" / "NOTE:" プレフィックス後の命令形は移送候補。
4. identifier に CJK 文字 (`const 状態 = ...`) — 真に typo か意図的かを識別するため、
   同一スコープ内の usage を確認。

## 移送判断 (人間 / agent)

i18n bundle (`src/shared/i18n/sections/**/*.ts`) は正しくできているため、JSX literal は
`useT('section.key')` 経由に統一する。doc-comment の説明文は移送不要。identifier の CJK は
真の typo のみ移送 (usage を確認)。

## 証跡

- `bun run scripts/audit-i18n-literals.mts` の実行結果
- journal への `i18n-literal-guard/{js-literal|attr-literal|comment-literal|identifier-literal}`
  カウンタ

## 既知の誤検知

- `src/features/create-tile/ui/ConditionEditor.tsx` の placeholder / label は i18n 化済み
  (`useT('create-tile.condition.*')`)。新規 placeholder 追加時は同じ hook を使う。
- `src/shared/i18n/sections/**/*.ts` 内の日本語は移送不要 (i18n bundle 本体)。

## 関連

- `docs/adr/0003-i18n-inline-literal-remediation.md` (policy §11 詳細)
- `.agents/skills/i18n-literal-guard/` thin adapter (`tastile-web/.claude/skills/i18n-literal-guard/SKILL.md`)
