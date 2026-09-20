---
name: next-dev-loop
description: Thin Claude Code adapter — canonical Skill lives at `.agents/skills/next-dev-loop/SKILL.md`. Read the canonical file for the full edit/verify loop using `/_next/mcp` and `agent-browser`.
---

# Next.js Dev Loop (adapter)

This is a Claude Code thin adapter. The canonical Skill lives at
`.agents/skills/next-dev-loop/SKILL.md`. Always read the canonical file —
this adapter only exists to register the Skill name in the Claude Code
skills namespace and to forward to the canonical source.

When this Skill fires:

1. Read `.agents/skills/next-dev-loop/SKILL.md` in full.
2. Confirm the hard floors (Next.js 16.3+ with Turbopack, `agent-browser`
   >= 0.31.1) — refuse and ask the user to upgrade if either is missing.
3. Run the preflight (open `agent-browser`, probe `/_next/mcp`),
   then enter the edit → four-mode-verify loop.
4. Do not duplicate the canonical content here. If the canonical file and
   this adapter disagree, the canonical file wins.