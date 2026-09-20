import { readFileSync } from "node:fs";
import path from "node:path";

// Resolves the running web app's version.
//
// Resolution order:
//   1. `process.env.NEXT_PUBLIC_APP_VERSION` — set at build time by the
//      Containerfile `ARG APP_VERSION` (and via `.env*` files for dev/CI).
//      This is the only path that works in `output: "standalone"` mode
//      because package.json is not bundled into `.next/standalone/`.
//   2. `package.json#version` on disk — works in `next dev`, unit tests,
//      and any non-standalone runtime where the source tree is reachable.
//   3. The literal `"0.0.0-dev"` sentinel — only hit if both above paths
//      fail (e.g. misconfigured production build). Surfaced verbatim so
//      monitoring can detect the regression.

const FALLBACK_VERSION = "0.0.0-dev";

function resolveFromPackageJson(): string {
	try {
		const pkgPath = path.join(process.cwd(), "package.json");
		const raw = readFileSync(pkgPath, "utf8");
		const parsed = JSON.parse(raw) as { version?: unknown };
		if (typeof parsed.version === "string" && parsed.version.length > 0) {
			return parsed.version;
		}
	} catch {
		// ignored — fall through to FALLBACK_VERSION
	}
	return FALLBACK_VERSION;
}

const WEB_APP_VERSION: string = (() => {
	const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
	if (fromEnv) return fromEnv;
	return resolveFromPackageJson();
})();

/**
 * Returns the web app version. Resolved once at module load and cached.
 * Sourced from `package.json#version` (the SoT) — either directly via
 * build-time env var injection, or by reading `package.json` from disk.
 */
export function getWebAppVersion(): string {
	return WEB_APP_VERSION;
}
