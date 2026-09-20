---
name: web-design-guidelines
description: Thin Claude Code adapter — canonical Skill lives at `.agents/skills/web-design-guidelines/SKILL.md`. Read the canonical file for the full Web Interface Guidelines review workflow.
---

# Web Interface Guidelines (adapter)

This is a Claude Code thin adapter. The canonical Skill lives at
`.agents/skills/web-design-guidelines/SKILL.md`. Always read the canonical
file — this adapter only exists to register the Skill name in the Claude
Code skills namespace and to forward to the canonical source.

When this Skill fires:

1. Read `.agents/skills/web-design-guidelines/SKILL.md` in full.
2. Follow its fetch → read → check → report loop, using
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
   as the live guidelines source.
3. Apply the terse `file:line` output format from the fetched guidelines.
4. Do not duplicate the canonical content here. If the canonical file and
   this adapter disagree, the canonical file wins.