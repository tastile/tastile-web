#!/usr/bin/env bun
/**
 * sync-openapi.ts
 *
 * Reads the canonical OpenAPI 3.1 spec from this repository's
 * `openapi/` submodule (pinned via .gitmodules) and regenerates the
 * local TypeScript types plus the vendored copies that this repo's
 * tooling reads.
 *
 * Output paths:
 *   src/lib/api/v1/openapi-generated.d.ts — TS types (via openapi-typescript)
 *   openapi.json                           — JSON copy (legacy tooling)
 *   public/openapi.yaml                    — YAML copy served by Next.js
 *                                            at /openapi.yaml
 *
 * Usage:
 *   bun run sync:openapi
 *
 * The submodule pointer bump itself is done with
 *   git submodule update --remote openapi
 * from this repository's root. This script picks up whatever version is
 * checked out at the submodule path.
 *
 * Why a separate script from `generate-openapi-types.ts`:
 *   - `generate-types` fetches the spec from a running tastile-core
 *     instance (dev hot-reload path; useful while iterating on new
 *     endpoints without committing the spec yet).
 *   - `sync:openapi` reads from this repository's submodule, which is
 *     the committed source of truth. This is what CI, `prebuild`, and
 *     release builds should run.
 *
 * Repository independence:
 *   `tastile-web` does not depend on `tastile-root` at build time. The
 *   submodule is owned by this repository; cloning
 *   https://github.com/tastile/tastile-web with `--recurse-submodules`
 *   is sufficient for `bun install && bun run sync:openapi && bun run
 *   build` to succeed without any sibling repo on disk.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// `openapi/openapi.yaml` is owned by this repository (see .gitmodules).
const SUBMODULE_YAML = resolve(ROOT, "openapi/openapi.yaml");
// CI / quality workflows historically staged a copy into `openapi-spec/`.
// Kept as a fallback so legacy CI scripts that pre-date the submodule
// migration still find a spec when the submodule is not initialised.
const CI_YAML = resolve(ROOT, "openapi-spec/openapi.yaml");

const OUTPUT_TYPES = resolve(ROOT, "src/lib/api/v1/openapi-generated.d.ts");
const OUTPUT_JSON = resolve(ROOT, "openapi.json");
const OUTPUT_PUBLIC_YAML = resolve(ROOT, "public/openapi.yaml");

// --------------- helpers ---------------

function fail(message: string, code = 1): never {
	console.error(`[openapi] ${message}`);
	process.exit(code);
}

function canonicalSpecPath(): string {
	const path = [SUBMODULE_YAML, CI_YAML].find((candidate) =>
		existsSync(candidate),
	);
	if (!path) {
		fail(
			`Canonical OpenAPI spec not found. Checked:\n` +
				`- ${SUBMODULE_YAML}\n` +
				`- ${CI_YAML}\n` +
				`Run \`git submodule update --init\` in this repository or stage the CI checkout.`,
			2,
		);
	}
	return path;
}

function readCanonicalYaml(): string {
	return readFileSync(canonicalSpecPath(), "utf-8");
}

function parseSpec(yamlText: string): unknown {
	// Bun.YAML.parse is built into bun@>=1.1.27; the project's
	// packageManager pins bun@1.3.14, so this is always available.
	// Returns `any` for the YAML 1.2 document type — we re-shape below.
	try {
		return Bun.YAML.parse(yamlText) as unknown;
	} catch (err) {
		fail(
			`Failed to parse ${canonicalSpecPath()} as YAML:\n  ${(err as Error).message}`,
			3,
		);
	}
}

function writeJsonCopy(spec: unknown): void {
	const text = JSON.stringify(spec, null, 2);
	if (!text) {
		fail("Failed to serialize parsed spec to JSON (got empty string).", 4);
	}
	writeFileSync(OUTPUT_JSON, `${text}\n`, "utf-8");
	console.log(`[openapi] Wrote ${OUTPUT_JSON} (${text.length} bytes)`);
}

// We copy the submodule YAML bytes verbatim to public/openapi.yaml.
// Re-serializing through Bun.YAML would risk subtle formatting drift
// against the canonical spec; copy-bytes preserves byte-identity and
// keeps Next.js serving an exact copy of the submodule.
function writePublicYamlCopy(yamlText: string): void {
	writeFileSync(OUTPUT_PUBLIC_YAML, yamlText, "utf-8");
	console.log(
		`[openapi] Wrote ${OUTPUT_PUBLIC_YAML} (${yamlText.length} bytes, verbatim)`,
	);
}

function readSpecVersion(): string {
	let raw: string;
	try {
		raw = readFileSync(OUTPUT_JSON, "utf-8");
	} catch {
		fail(`Spec JSON not found: ${OUTPUT_JSON}`);
	}
	const version = (JSON.parse(raw) as { info?: { version?: unknown } }).info
		?.version;
	if (typeof version !== "string" || version.length === 0) {
		fail(`Spec JSON has no info.version: ${OUTPUT_JSON}`);
	}
	return version;
}

function generateTypes(): void {
	console.log(
		"[openapi] Generating TypeScript types via openapi-typescript ...",
	);
	// openapi-typescript accepts both JSON and YAML; we pass the JSON
	// copy so the tool can resolve a file URL (it does not accept
	// arbitrary Blob/ArrayBuffer input on the CLI).
	execSync(`npx openapi-typescript ${OUTPUT_JSON} -o ${OUTPUT_TYPES}`, {
		cwd: ROOT,
		stdio: "inherit",
		env: { ...process.env },
	});

	const header = [
		"// Auto-generated from this repository's OpenAPI submodule.",
		"// Run `bun run sync:openapi` to refresh.",
		"// DO NOT EDIT MANUALLY.",
		"//",
		"// Source: openapi/openapi.yaml (this repository's submodule).",
		`// Spec version: ${readSpecVersion()}`,
		"",
	].join("\n");

	const content = readFileSync(OUTPUT_TYPES, "utf-8");
	writeFileSync(OUTPUT_TYPES, header + content, "utf-8");

	console.log(`[openapi] Done → ${OUTPUT_TYPES}`);
}

// --------------- main ---------------

async function main(): Promise<void> {
	const yamlText = readCanonicalYaml();
	if (!yamlText.trim()) {
		fail(`Canonical OpenAPI spec is empty: ${canonicalSpecPath()}`, 5);
	}

	const spec = parseSpec(yamlText);

	// Order matters: write JSON first so generateTypes() can point
	// openapi-typescript at it.
	writeJsonCopy(spec);
	writePublicYamlCopy(yamlText);
	generateTypes();
}

main().catch((err) => {
	console.error("[openapi] Error:", (err as Error).message);
	process.exit(1);
});
