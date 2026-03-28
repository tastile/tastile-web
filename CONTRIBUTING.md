# Contributing

## First Read

Before touching execution logic or storage, read:

1. `AGENTS.md`
2. `../pomodoroom/CORE_POLICY.md`
3. `../tastile_docs_bundle/tastile_docs/01_Foundation_and_Core_Principles.md`
4. `../tastile_docs_bundle/tastile_docs/03_Domain_Model_and_Tile_Conditions.md`
5. `../tastile_docs_bundle/tastile_docs/04_Command_Event_and_Reducer_Model.md`

## Local Workflow

Install dependencies:

```bash
npm ci
```

Run the standard validation set:

```bash
npm run check
```

Run release validation:

```bash
npm run check:release
npm run test:e2e
```

## Repo Conventions

- Keep domain changes inside `src/lib/domain` and `src/lib/core`
- Keep Supabase access isolated under `src/lib/storage` or `src/lib/supabase`
- Avoid hiding product logic in route handlers or React components
- Do not add new state shortcuts that duplicate derived values
- Prefer adding or tightening tests alongside behavior changes

## Pull Request Standards

- Explain the user-facing or architectural reason for the change
- Mention any doc/spec files that justified the implementation
- List which validation commands were run
- Keep unrelated cleanup out of the same PR
