---
name: i18n-literal-guard
description: tastile-web の policy §11 (i18n hardcoded literal) 違反を release 前 / bump 直前に read-only で検出する。JSX / doc-comment / identifier の CJK literal を分類し、移送判断は人間 / agent に委ねる。
---

canonical Skill は `tastile-web/.agents/skills/i18n-literal-guard/SKILL.md` である。発火時に
その全文を読み、binding workflow として実行する。この adapter に手順を複製しない。

scope: `tastile-web` 専用。workspace 共通の canonical は存在しない (web-local 拡張)。
