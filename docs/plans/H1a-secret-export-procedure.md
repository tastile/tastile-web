# H1a — Infisical secret injection

## Status: retired manual export procedure

This plan described exporting `TASTILE_WEB_BRIDGE_SECRET` from local dotenv files. Those steps are obsolete and must not be used. The bridge secret is managed in Infisical at `/tastile/web` and `/tastile/core` for the selected environment.

Use the repository's authenticated launcher instead:

```bash
bun scripts/run-with-infisical.mts dev -- bash scripts/wslc/up.sh
```

Do not copy secret values into shell history, documentation, or dotenv files. The launcher injects the selected Infisical environment into the command process and fails closed when authentication or required secrets are unavailable.