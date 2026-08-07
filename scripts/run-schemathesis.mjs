#!/usr/bin/env node
// Cross-platform wrapper around `uvx schemathesis run` that fixes the
// Windows-console UnicodeEncodeError (`rich` -> `✅` -> cp932 crash),
// defaults to the prod Tastile Core API OpenAPI URL, and optionally
// injects a Bearer auth header from TASTILE_TEST_TOKEN.
//
// Usage:
//   node scripts/run-schemathesis.mjs                                # prod, unauth
//   TASTILE_TEST_TOKEN=eyJ... node scripts/run-schemathesis.mjs      # prod, auth'd
//   node scripts/run-schemathesis.mjs http://localhost:3000/api/openapi
//   node scripts/run-schemathesis.mjs URL --checks=not_a_server_error --max-examples=2
//
// See docs/plans/2026-08-06-schemathesis-contract-testing.md (L1) and
// docs/plans/2026-08-06b-schemathesis-auth-and-state.md (L2).

import { spawn } from "node:child_process";

const DEFAULT_URL = "https://app.tastile.app/api/openapi";

const argv = process.argv.slice(2);
const urlArg = argv.find((a) => a.startsWith("http"));
const rest = argv.filter((a) => a !== urlArg);
const url = urlArg ?? DEFAULT_URL;

// Optional Bearer auth — opt-in via env var. Token must be a real
// test-user api-token; fuzz POSTs against prod with this token will
// mutate real data, so use a dedicated test identity.
const authHeader = process.env.TASTILE_TEST_TOKEN
  ? ["--header", `Authorization: Bearer ${process.env.TASTILE_TEST_TOKEN}`]
  : [];

// Windows-console Unicode crash fix. Harmless on POSIX.
const env = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  PYTHONUTF8: "1",
  PYTHONLEGACYWINDOWSSTDIO: "0",
};

// Operations that are intentionally anonymous (no Authorization header).
// schemathesis v4 toml doesn't support per-op [checks.ignored_auth]
// exclusion, so we pass --exclude-operation here.
const EXCLUDED_OPERATIONS = ["signOut"];

const proc = spawn(
  "uvx",
  [
    "schemathesis",
    "run",
    url,
    ...authHeader,
    ...EXCLUDED_OPERATIONS.flatMap((op) => ["--exclude-operation-id", op]),
    ...rest,
  ],
  { stdio: "inherit", env },
);

proc.on("error", (err) => {
  console.error(`failed to spawn uvx: ${err.message}`);
  console.error("install with: pipx install schemathesis  (or pip install --user schemathesis)");
  process.exit(127);
});

proc.on("exit", (code, signal) => {
  if (signal) {
    console.error(`uvx terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});