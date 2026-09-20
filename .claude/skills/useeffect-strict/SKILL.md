---
name: useeffect-strict
description: Thin Claude Code adapter — canonical Skill lives at `.agents/skills/useeffect-strict/SKILL.md`. Read the canonical file for the full uhyo-aligned useEffect rules, anti-patterns, and known violations.
---

# useEffect Strict (adapter)

This is a Claude Code thin adapter. The canonical Skill lives at
`.agents/skills/useeffect-strict/SKILL.md`. Always read the canonical file —
this adapter only exists to register the Skill name in the Claude Code skills
namespace and to forward to the canonical source.

When this Skill fires:

1. Read `.agents/skills/useeffect-strict/SKILL.md` in full.
2. Apply the anti-pattern table, the red-flag list, and the triage checklist
   to any new or edited `useEffect` / `useLayoutEffect` in `src/**`.
3. Do not duplicate the canonical content here. If the canonical file and this
   adapter disagree, the canonical file wins.
