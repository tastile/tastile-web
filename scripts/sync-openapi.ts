#!/usr/bin/env bun
/**
 * sync-openapi.ts
 *
 * Reads the canonical OpenAPI 3.1 spec from the cross-repo submodule
 * (`../openapi/openapi.yaml`) and regenerates the local TypeScript
 * types plus the vendored copies that this repo's tooling reads.
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
 * This is the canonical path for refreshing client types when the
 * canonical spec changes. The submodule pointer bump itself is done by
 * the cross-repo workspace tooling; this script picks up whatever
 * version is checked out at the submodule path.
 *
 * Why a separate script from `generate-openapi-types.ts`:
 *   - `generate-types` fetches the spec from a running tastile-core
 *     instance (dev hot-reload path; useful while iterating on new
 *     endpoints without committing the spec yet).
 *   - `sync:openapi` reads from the cross-repo submodule, which is the
 *     committed source of truth. This is what CI, `prebuild`, and
 *     release builds should run.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// `../openapi/openapi.yaml` from `tastile-web/` resolves to
// `tastile-root/openapi/openapi.yaml` — the submodule at the
// workspace-shell level.
const SUBMODULE_YAML = resolve(ROOT, "../openapi/openapi.yaml");

const OUTPUT_TYPES = resolve(ROOT, "src/lib/api/v1/openapi-generated.d.ts");
const OUTPUT_JSON = resolve(ROOT, "openapi.json");
const OUTPUT_PUBLIC_YAML = resolve(ROOT, "public/openapi.yaml");

// --------------- helpers ---------------

function fail(message: string, code = 1): never {
	console.error(`[openapi] ${message}`);
	process.exit(code);
}

function assertSubmodulePresent(): void {
	if (!existsSync(SUBMODULE_YAML)) {
		fail(
			`Submodule spec not found: ${SUBMODULE_YAML}\n` +
				`Run \`git submodule update --init\` at the workspace root.\n` +
				`If the submodule is intentionally absent for this checkout, this script cannot run.`,
			2,
		);
	}
}

function readCanonicalYaml(): string {
	return readFileSync(SUBMODULE_YAML, "utf-8");
}

function parseSpec(yamlText: string): unknown {
	// Bun.YAML.parse is built into bun@>=1.1.27; the project's
	// packageManager pins bun@1.3.14, so this is always available.
	// Returns `any` for the YAML 1.2 document type — we re-shape below.
	try {
		return Bun.YAML.parse(yamlText) as unknown;
	} catch (err) {
		fail(
			`Failed to parse ${SUBMODULE_YAML} as YAML:\n  ${(err as Error).message}`,
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
		"// Auto-generated from the cross-repo OpenAPI submodule.",
		"// Run `bun run sync:openapi` to refresh.",
		"// DO NOT EDIT MANUALLY.",
		"//",
		`// Generated at: ${new Date().toISOString()}`,
		`// Submodule source: ${SUBMODULE_YAML}`,
		"",
	].join("\n");

	const content = readFileSync(OUTPUT_TYPES, "utf-8");
	writeFileSync(OUTPUT_TYPES, header + content, "utf-8");

	console.log(`[openapi] Done → ${OUTPUT_TYPES}`);
}

// --------------- main ---------------

async function main(): Promise<void> {
	assertSubmodulePresent();

	const yamlText = readCanonicalYaml();
	if (!yamlText.trim()) {
		fail(`Submodule spec is empty: ${SUBMODULE_YAML}`, 5);
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
