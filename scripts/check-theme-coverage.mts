#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REQUIRED_SELECTORS = [
	":root",
	".dark",
	".theme-gray",
	".theme-dark",
	".theme-dark-black",
	".theme-dark-gray",
] as const;

function main(): void {
	const cssPath = resolve(__dirname, "../src/app/globals.css");
	const css = readFileSync(cssPath, "utf8");

	const missing: string[] = [];
	for (const sel of REQUIRED_SELECTORS) {
		// For `:root`, match the exact `:root {` opener.
		// For class selectors, match the class name as a token (preceded by
		// space / `{` / `,`).
		const re =
			sel === ":root"
				? /:root\s*\{/
				: new RegExp(`(?:^|[\\s,])${sel.replace(/\./g, "\\.")}\\b`);
		if (!re.test(css)) {
			missing.push(sel);
		}
	}

	if (missing.length > 0) {
		console.error(`Missing theme selectors in src/app/globals.css:`);
		for (const sel of missing) {
			console.error(`  - ${sel}`);
		}
		process.exit(1);
	}

	console.log(
		`OK: all ${REQUIRED_SELECTORS.length} theme selectors present in src/app/globals.css`,
	);
}

main();
