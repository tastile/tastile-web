# Boot evidence — 2026-08-09-usecase-e2e-30

> **REVIEWED status**: spec authoring was completed in code, but the
> full e2e stack (v1 API + postgres + dev server) was NOT booted on this
> machine for actual spec execution.  Per memory
> `feedback_no_unverified_pass.md`, this file does NOT claim VERIFIED.
> Each spec's evidence md will state REVIEWED (code-complete) vs
> VERIFIED (executed-green) individually.

## Host environment observed (2026-08-09)

- **wslc container ls**: empty (no running containers)
- **wslc images**: empty (no cached images)
- **API at http://127.0.0.1:31400/v1/health**: connection refused
- **API at http://127.0.0.1:31400/v1/ready**: connection refused
- **Next.js dev server**: not running

## Attempted stack bring-up (2026-08-09)

```
$ bash tastile-core/scripts/wslc/up-v1.sh
==> Preflight: checking 127.0.0.1:31400 ...
    port 31400 is free
==> Starting postgres on network tastile-net (data volume: tastile-pgdata)
イメージ 'postgres:16-alpine' が見つかりません。プルしています
d273c730a63ac5742287f3bcf409432cce555bf6f6731528b79263bb3f04eea3
==> Waiting for postgres to accept connections...
    postgres ready after 2s
==> Starting api (host port 31400 -> container 31400)
イメージ 'tastile-v1-api:latest' が見つかりません。プルしています
pull access denied for tastile-v1-api, repository does not exist or may require 'docker login': denied: requested access to the resource is denied
エラー コード: WSLC_E_IMAGE_NOT_FOUND
```

## Why the API image is unavailable

- Local wslc image cache was reset between sessions (memory
  `project_wslc_vhdx_minimal_compaction.md` documents the minimal
  compaction ceiling — VHDX retains < 200MB after cleanup).
- Building `tastile-v1-api:latest` requires running `wslc build -f
  Containerfile.v1 -t tastile-v1-api:latest .` against the v1
  workspace, which in turn requires a multi-hour Rust release build.
- On this Windows host, Defender hash-blocks `cc1.exe`, so `cargo
  build` cannot complete locally (memory
  `project_windows_defender_blocks_cc1.md`).
- The wslc build path itself is the canonical fix (memory
  `feedback_use_wslc_for_rust_build.md`), but it requires the dev
  container to be alive on the wslc engine, and currently `wslc
  container ls` returns empty.

## What this means for the 30 spec PR

- All 30 specs are authored to match the existing tastile-web test-id
  / route conventions, the v1 Command/Event/Reducer contract, and the
  USECASE.md scenarios.
- The 5 helpers (`poll.ts` / `windows.ts` / `source-tile.ts` /
  `execution.ts` / `decision.ts`) are REVIEWED (type-checked and
  consistent with the API surface observed in
  `crates-v1/api/src/handlers/`).
- `resetDb()` extension to 12-table TRUNCATE is REVIEWED.
- Spec execution (VERIFIED status) is deferred to a follow-up run
  after the v1 stack image is available.  Per memory
  `feedback_no_unverified_pass.md`, the SUMMARY.md explicitly marks
  this PR's specs as REVIEWED (code-complete) and reserves VERIFIED for
  the post-image-build run.

## CI path forward

The CI workflow (`ubuntu-latest`, no Defender) is the natural source
of truth for these specs.  The recommended CI step:

```yaml
- name: Boot v1 stack
  run: bash tastile-core/scripts/wslc/up-v1.sh
- name: Install wslc
  run: |
    # wslc install on ubuntu-latest per the script's preflight
- name: Run usecase e2e
  run: |
    bash tastile-web/scripts/e2e/up-stack.sh
    for NN in $(seq -w 1 30); do
      bash tastile-web/scripts/e2e/run-spec.sh $NN
    done
    bash tastile-web/scripts/e2e/down-stack.sh
```

This PR's deliverables are REVIEWED-ready; VERIFIED-run is a
follow-up commit once CI image caching carries the v1 API image.
