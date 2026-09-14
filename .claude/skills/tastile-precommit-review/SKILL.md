---
name: tastile-precommit-review
description: Use when independently reviewing a Tastile Web change immediately before an agent-initiated commit. Web-specific security boundaries (Cognito, cookies, server-only secrets, Stripe, proxy, prod env isolation).
---

canonical Skill は `tastile-web/.agents/skills/tastile-precommit-review/SKILL.md` である
(web-specific overlay: Cognito verification, cookie/token ownership, server-only secrets,
Stripe ownership, proxy boundaries, production environment isolation)。発火時にその全文を
読み、binding workflow として実行する。この adapter に手順を複製しない。

## precedence (per recon audit 2026-09-12)

workspace 側に同名 Skill (`.agents/skills/tastile-precommit-review/SKILL.md`) があり、
両者は scope が異なる:

- workspace canonical = root workspace + 5 child repositories + 共有 `.agent-loop/`、
  `.claude/`、`.codex/` の構造。必須証跡 = `pwsh -NoProfile -File .agent-loop/gate-root.ps1`
- web canonical (本 adapter) = `tastile-web` の web 専用 security boundary。必須証跡 =
  `bun run check` + focused tests on auth / billing / event / deploy 変更

**tastile-web 配下から発火する場合は本 adapter (web canonical) を優先する。** workspace
canonical は root / sibling child repository を触る commit で発火する。

resolver rule: 起動 cwd が `tastile-web/` 配下なら web canonical、それ以外は workspace
canonical。orchestration layer (`.agents/skills/subagent-coordination/SKILL.md`) が同名を
発見した場合は web canonical を優先ルート、workspace canonical を補助参照として扱う。
