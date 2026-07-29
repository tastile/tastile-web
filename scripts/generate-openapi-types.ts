#!/usr/bin/env bun
/**
 * generate-openapi-types.ts
 *
 * Fetches the v1 OpenAPI spec from tastile-core and generates TypeScript
 * types via openapi-typescript. Output goes to
 * `src/lib/api/v1/openapi-generated.d.ts`.
 *
 * Usage:
 *   bun run generate-types              # fetch from core → generate
 *   bun run generate-types --offline    # use cached openapi.json
 *   CORE_URL=http://... bun run generate-types  # override core URL
 *
 * The generated file is committed to the repo so CI / builds don't need
 * a running core. Run `bun run generate-types` whenever the core API
 * changes to refresh the snapshot.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const CACHE_PATH = resolve(ROOT, ".openapi-cache.json");
const OUTPUT_PATH = resolve(ROOT, "src/lib/api/v1/openapi-generated.d.ts");

// --------------- fetch spec ---------------

async function fetchSpec(): Promise<string> {
  const coreUrl =
    process.env.CORE_URL ||
    process.env.CLOUD_API_BASE ||
    process.env.TASTILE_RUST_API_URL ||
    "http://127.0.0.1:31400";

  const url = `${coreUrl.replace(/\/+$/, "")}/v1/openapi.json`;
  console.log(`[openapi] Fetching ${url} ...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}\n` +
        `URL: ${url}\n` +
        `Hint: Is tastile-core running? Set CORE_URL if needed.`,
    );
  }
  const text = await res.text();
  // Validate it's real JSON
  JSON.parse(text);
  return text;
}

// --------------- main ---------------

async function main() {
  const offline = process.argv.includes("--offline");

  let specText: string;

  if (offline) {
    if (!existsSync(CACHE_PATH)) {
      console.error(`[openapi] No cached spec at ${CACHE_PATH}. Run without --offline first.`);
      process.exit(1);
    }
    specText = readFileSync(CACHE_PATH, "utf-8");
    console.log("[openapi] Using cached spec from .openapi-cache.json");
  } else {
    try {
      specText = await fetchSpec();
      writeFileSync(CACHE_PATH, specText, "utf-8");
      console.log(`[openapi] Cached spec to ${CACHE_PATH}`);
    } catch (err) {
      if (existsSync(CACHE_PATH)) {
        console.warn(
          `[openapi] Fetch failed, falling back to cached spec:\n  ${(err as Error).message}`,
        );
        specText = readFileSync(CACHE_PATH, "utf-8");
      } else {
        throw err;
      }
    }
  }

  // Write the spec to a temp file for openapi-typescript to read
  const tempSpec = resolve(ROOT, ".openapi-temp.json");
  writeFileSync(tempSpec, specText, "utf-8");

  // Run openapi-typescript
  console.log("[openapi] Generating TypeScript types ...");
  try {
    execSync(`npx openapi-typescript ${tempSpec} -o ${OUTPUT_PATH}`, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env },
    });
  } finally {
    // Clean up temp file
    if (existsSync(tempSpec)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tempSpec);
    }
  }

  // Post-generation: add a header comment
  const header = [
    "// Auto-generated from tastile-core OpenAPI spec.",
    "// Run `bun run generate-types` to refresh.",
    "// DO NOT EDIT MANUALLY.",
    "//",
    `// Generated at: ${new Date().toISOString()}`,
    "//",
    "",
  ].join("\n");

  const content = readFileSync(OUTPUT_PATH, "utf-8");
  writeFileSync(OUTPUT_PATH, header + content, "utf-8");

  console.log(`[openapi] Done → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[openapi] Error:", (err as Error).message);
  process.exit(1);
});
