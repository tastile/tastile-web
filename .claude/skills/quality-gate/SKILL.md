---
name: quality-gate
description: Run the full quality gate after any implementation task. Covers Biome syntax check, ESLint, typecheck, Knip dead-code analysis, Vitest unit/component tests, and build verification. Use at task completion or when asked to verify changes.
---

# Quality Gate

Thin adapter — canonical source: `.agents/skills/quality-gate/SKILL.md`

Read the canonical Skill file and follow every step.

## Quick reference

```bash
bun run check          # full gate (biome + eslint + typecheck + knip + vitest)
bun run check:release  # gate + audit + build:prod (shipping only)
bun run test:e2e       # Playwright (UI changes)
```

All steps must pass with **0 errors / 0 actionable warnings / 0 unjustified suppressions**.
