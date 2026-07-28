#!/usr/bin/env node
// Minimal wrapper around `vitest --run`. Forwards vitest's exit code.
// Resolves the vitest.mjs entry directly through node_modules to match the
// module-resolution path that `bunx vitest` uses (which `bun run test:unit`
// is supposed to mirror). Wrapping for the wrapper's own sake (e.g. capturing
// the entry path) is intentional — it is not a place to hide warnings.
//
// Test env defaults live in `vitest.config.ts` (`test.env`). We
// intentionally do NOT load `.env.local` here because it sets
// `E2E_BYPASS_AUTH=1` and other production-shape flags that flip
// auth/owner-derivation paths and break the negative-path tests
// (`/api/me` should 401 when no id_token cookie is present, not
// short-circuit on E2E_BYPASS_AUTH and return 200).
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const vitestEntry = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const testEnv = { ...process.env };

// Bun loads mode-specific .env files before invoking this wrapper. Keep
// production/development auth switches from changing unit-test semantics.
for (const key of [
  "E2E_BYPASS_AUTH",
  "NEXT_PUBLIC_E2E_BYPASS_AUTH",
  "COGNITO_SUPPORTED_IDENTITY_PROVIDERS",
  "NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS",
  "NEXT_PUBLIC_COGNITO_SUPPORTED_IDENTITY_PROVIDERS",
]) {
  delete testEnv[key];
}

const child = spawn(process.execPath, [vitestEntry, "run"], {
  stdio: "inherit",
  cwd: repoRoot,
  env: testEnv,
});
child.on("exit", (code) => process.exit(code ?? 1));
