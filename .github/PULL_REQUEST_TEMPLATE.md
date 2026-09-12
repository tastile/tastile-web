<!--
Release sprint workflow (ADR-0007) — 4 marker を必ず残す。
`release-branch-workflow` Skill と `verify-tastile-change` Skill を
pre-merge に発火する。
-->

## Summary

- 何を / なぜ / どう変更したか (1 段落)

## Issue

- `resolves #<n>` または `part of #<n>`

## Target Release

- `release-x-y-z` または `-` (main 直 commit)

## Branch

- `git rev-parse --abbrev-ref HEAD` の結果
- canonical pattern: `^(?:[0-9]+|release-[0-9]+-[0-9]+-[0-9]+|main)$`

## Execution Generation

- `1` (default) または recovery 後の increment 値 (ADR-0008)

## Validation

- [ ] `bun run check` exited `0` (biome + eslint + typecheck + knip + vitest)
- [ ] `bun run build` exited `0` (route / handler 変更時のみ)
- [ ] `bun run build:prod` exited `0` (artifact 変更時のみ)
- [ ] `bun test <focal-path>` を focal に実行し pass
- [ ] `bun run test:e2e` が green (auth / billing / proxy / event 変更時のみ)
- [ ] UI 変更は `.tmp/<screenshot>.png` を `docs/plans/evidence/` に保存した
- [ ] `scripts/release/release-checkpoint.sh` の出力 journal を `docs/journal/<env>/<date>.jsonl` に記録した

## Project fields (ADR-0009)

- `priority` / `size` / `target_version` / `area` を Issue 側で更新した
- Status を `In Review` に進めた

## Checks

- [ ] `verify-tastile-change` Skill を発火した
- [ ] `tastile-precommit-review` Skill (web canonical, ADR-0011) を発火した
- [ ] 関連 ADR / Skill を更新した (この PR が workflow / canonical contract を変える場合)
- [ ] `docs/HARNESS.md` §n を更新した (この PR が architecture / 手順を変える場合)
- [ ] `AGENTS.md` の ADR pointer を更新した (この PR が web の binding ADR を変える場合)
- [ ] `SECURITY.md` の報告経路に影響する変更ではない (Cognito / Stripe / cookie / proxy boundary)

## Notes
