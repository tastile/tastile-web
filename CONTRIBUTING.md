# Contributing

## First Read

Before touching execution logic or storage, read:

1. `AGENTS.md`
2. `../tastile-core/v1/02-core-entities.md` — v1 ドメインモデル
3. `../tastile-core/v1/10-invariants.md` — 不変条件
4. `../tastile-core/v1/14-read-model-and-endpoint.md` — API 仕様

## Local Workflow

Install dependencies:

```bash
bun install
```

Run the standard validation set:

```bash
bun run check
```

Run release validation:

```bash
bun run check:release
bun run test:e2e
```

## Repo Conventions

- Keep domain changes inside `src/lib/domain` and `src/lib/core`
- Keep tastile-core API access isolated under `src/lib/storage` or `src/lib/api`
- Avoid hiding product logic in route handlers or React components
- Do not add new state shortcuts that duplicate derived values
- Prefer adding or tightening tests alongside behavior changes

## Pull Request Standards

- Explain the user-facing or architectural reason for the change
- Mention any doc/spec files that justified the implementation
- List which validation commands were run
- Keep unrelated cleanup out of the same PR
