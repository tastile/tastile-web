#!/usr/bin/env node
// Minimal wrapper around `vitest --run`. Forwards vitest's exit code.
// Resolves the vitest.mjs entry directly through node_modules to match the
// module-resolution path that `bunx vitest` uses (which `bun run test:unit`
// is supposed to mirror). Wrapping for the wrapper's own sake (e.g. capturing
// the entry path) is intentional — it is not a place to hide warnings.
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const vitestEntry = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");

const child = spawn(process.execPath, [vitestEntry, "run"], {
  stdio: "inherit",
  cwd: repoRoot,
});
child.on("exit", (code) => process.exit(code ?? 1));
