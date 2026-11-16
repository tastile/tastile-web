# Monthly recurrence verification

Run on 2026-11-16. Test data was synthetic and stored only in the isolated PostgreSQL container `tw-monthly-pg` on port `55610`. Core used port `31610`; Playwright used Web port `3010`. The Web dev server obtained its environment through `scripts/run-with-infisical.mts`; secret values are omitted.

## Commands and results

```sh
git -C /tmp/tw-monthly-core rev-parse HEAD
# 6dfb74428fd6a62176e8b4931634805c0f94d788

CARGO_TARGET_DIR=/tmp/tw-monthly-core-target cargo build --release --manifest-path /tmp/tw-monthly-core/crates-v1/Cargo.toml -p api
# PASS; produced /tmp/tw-monthly-core-target/release/api

CARGO_TARGET_DIR=/tmp/tw-monthly-core-target cargo test --release --manifest-path /tmp/tw-monthly-core/crates-v1/Cargo.toml -p domain monthly_by_ -- --nocapture
# PASS: 5 monthly domain tests

bun run sync:openapi
# PASS; regenerated both generated type files from OpenAPI submodule v3.1.0

bun run typecheck
# PASS (rerun after OpenAPI sync)

TZ=Asia/Tokyo bunx vitest run src/shared/api/v1/quick-create-schedule-wire.test.ts src/features/create-tile/ui/QuickCreateRecurring.test.tsx
# PASS: 125 tests

PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 \
PLAYWRIGHT_CORE_URL=http://127.0.0.1:31610 \
PLAYWRIGHT_E2E_BYPASS_AUTH=1 \
PLAYWRIGHT_WEB_SERVER_COMMAND='bun scripts/run-with-infisical.mts dev -- env TASTILE_ENV=development PORT=3010 CLOUD_API_BASE=http://127.0.0.1:31610 TASTILE_RUST_API_URL=http://127.0.0.1:31610 NEXT_PUBLIC_DAEMON_BASE_URL=http://127.0.0.1:31610 NEXT_PUBLIC_TASTILE_CORE_URL=http://127.0.0.1:31610 NEXT_PUBLIC_TASTILE_CORE_V1_URL= E2E_BYPASS_AUTH=1 NEXT_PUBLIC_E2E_BYPASS_AUTH=1 bun run next dev' \
TZ=Asia/Tokyo bun run test:e2e -- e2e/monthly-recurrence.spec.ts --project=chromium --retries=0
# PASS: 4 Playwright tests against browser -> Web -> Core -> PostgreSQL -> placement readback

bun run check
# PASS: 172 files passed, 1 skipped; 1,345 tests passed, 1 skipped

mkdir -p .tmp && bun run scripts/audit-i18n-literals.mts > .tmp/web221-i18n-audit.json
# AUDIT: 684 files scanned, 23 project-wide findings; no new non-i18n source literals

git -c core.whitespace=cr-at-eol diff --check
# PASS
```

The i18n literal audit scanned 684 source files and reported 23 project-wide findings. No newly added non-i18n source line contains CJK text; the new user-facing copy is in the localized quick-create bundle.

## Contract review

- **Producer:** Core release `6dfb7442` defines Monthly kind `3`, validates `monthly_rule`, and serializes it in the source-generation model. Its isolated startup applied migration `V1_078__source_monthly_generation`; the live API test read monthly placements back from PostgreSQL.
- **Schema:** OpenAPI submodule `v3.1.0` at `1839c638` defines `MonthlyRuleSchema` and `generation.monthly_rule`; `bun run sync:openapi` regenerated both Web type files from that pinned schema.
- **Web consumer:** The E2E trace confirms monthly generation kind `3`, nested `monthly_rule`, no top-level rule or daily interval, persisted placements, and a visible 422 error.
- **Android:** Its current quick-create payload uses the separate `objective.recurrence` expression format (`monthly:<interval>:<week>:<weekday>`), not the v1 schedule-definition wire changed here. It was left untouched.
- **Desktop:** No desktop checkout is present in this workspace. This change consumes the already released Core contract and does not modify the Core producer/API.
