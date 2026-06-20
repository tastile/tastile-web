#!/usr/bin/env node
// Wrapper around `vitest --run` that filters Node 25's jsdom child-process
// experimental-flag warning (--localstorage-file without a value) so the
// output stays clean. Forwards the exit code from vitest.
//
// We invoke the vitest.mjs entry directly with NODE_OPTIONS=--no-warnings so
// module resolution matches `bun run test:unit` (which resolves through
// node_modules/.bin/vitest.cmd -> node vitest.mjs).
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const vitestEntry = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");

const child = spawn(process.execPath, [vitestEntry, "run"], {
  stdio: ["inherit", "inherit", "pipe"],
  cwd: repoRoot,
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --no-warnings`.trim() },
});

let stderrBuf = "";
child.stderr.on("data", (chunk) => {
  stderrBuf += chunk.toString();
});
child.stderr.on("end", () => {
  const filtered = stderrBuf
    .split("\n")
    .filter(
      (line) =>
        !line.includes("--localstorage-file") &&
        !line.includes("--trace-warnings") &&
        !line.includes("--trace-deprecation"),
    )
    .join("\n");
  if (filtered.trim()) process.stderr.write(filtered);
});
child.on("exit", (code) => process.exit(code ?? 1));
