# React Doctor 210-Finding Remediation Plan

> **Goal:** Reconcile the supplied 210 diagnostics with a fresh full scan, fix every actionable root cause without suppressions, and verify each group against React Doctor itself.
>
> **Execution mode:** Working tree only. Do not stage, commit, push, reset, or overwrite concurrent changes.

## Constraints

- Fetch each rule's canonical documentation and fix/validation prompt with `Cache-Control: no-cache` before editing.
- The supplied `diagnostics.json` has no `fixGroupId`; group only after matching the exact message and code shape. Never invent tool metadata.
- Start with the three requested groups: callback JSON XSS, MFA page client fetch, then React Compiler unsupported syntax.
- Explain every root-cause group in plain language: problem, why it matters, real-world impact, severity, change, and proof.
- Canonical false positives remain unchanged and unsuppressed; report them explicitly.
- Preserve concurrent user-owned changes in `package.json`, `bun.lock`, and `src/lib/api/v1/active-tile.test.ts` unless the user later says otherwise.

## Tasks

1. **Live baseline** — run full verbose and JSON scans, compare with the supplied 210 entries, fetch canonical prompts, and build an exact root-cause ledger.
2. **Callback XSS** — add a failing test for `</script>` breakout, implement script-safe JSON serialization in `src/app/auth/callback-html.ts`, then run the test, typecheck, and full Doctor scan.
3. **MFA boundary** — split `src/app/auth/mfa-setup/page.tsx` into a Server Component page and interactive Client Component child; preserve Cognito setup/verification cookie behavior and remove explicit throw control flow; test and full-scan.
4. **Compiler and remaining errors** — fix React Compiler unsupported syntax serially per file, then cleanup/purity errors, with targeted tests, per-file typecheck, and full scans per root cause.
5. **Warnings** — process security/SSR/async, effect/state, accessibility/key, memoization, and giant-component groups using each canonical recipe. Verify each actionable group with the real tool.
6. **Review** — run mandatory spec and code-quality review after major tranches; independently verify feedback before applying it.
7. **Final validation** — run full and changed Doctor scans, Biome, ESLint, TypeScript, unit tests, build, composite check, and diff review. Report before/after counts, canonical false positives, risks, improvements, and non-destructive rollback guidance.

## Definition of done

- Zero live actionable React Doctor findings; any remaining diagnostics are canonical false positives with evidence.
- `bun run check` and `bun run build` pass.
- Mandatory review findings are resolved.
- Doctor changes are unstaged and uncommitted for user review.
