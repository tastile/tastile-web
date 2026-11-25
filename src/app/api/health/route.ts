import { getCloudApiBase } from "@/lib/upstream/cloud-api-base";
import { getWebAppVersion } from "@/lib/app-version";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORE_HEALTH_TIMEOUT_MS = 2_000;

/**
 * GET /api/health — liveness probe for the standalone container
 * (NF04-W01 / tastile-web#252).
 *
 * Default (`/api/health`): process liveness only. Always 200 once the
 * Next.js server is serving; used by the container HEALTHCHECK so a Core
 * API outage never restart-loops the web tier.
 *
 * `?deep=1`: readiness probe. Additionally fetches the v1 Core
 * `GET /v1/health` endpoint (see tastile-core crates-v1/api/src/lib.rs)
 * with a short timeout and returns 503 when Core is unreachable. This is
 * for operators / uptime checks, not for the Docker healthcheck.
 */
export async function GET(request: Request) {
	const deep = new URL(request.url).searchParams.get("deep") === "1";

	if (!deep) {
		return NextResponse.json(
			{ status: "ok", service: "tastile-web", version: getWebAppVersion() },
			{ headers: { "cache-control": "no-store" } },
		);
	}

	let coreBase = "";
	try {
		coreBase = getCloudApiBase();
	} catch {
		coreBase = "";
	}
	if (!coreBase) {
		return NextResponse.json(
			{ status: "degraded", reason: "core_base_unconfigured" },
			{ status: 503, headers: { "cache-control": "no-store" } },
		);
	}

	try {
		const response = await fetch(`${coreBase}/v1/health`, {
			cache: "no-store",
			signal: AbortSignal.timeout(CORE_HEALTH_TIMEOUT_MS),
		});
		if (!response.ok) {
			return NextResponse.json(
				{ status: "degraded", reason: "core_unhealthy", core_status: response.status },
				{ status: 503, headers: { "cache-control": "no-store" } },
			);
		}
	} catch {
		return NextResponse.json(
			{ status: "degraded", reason: "core_unreachable" },
			{ status: 503, headers: { "cache-control": "no-store" } },
		);
	}

	return NextResponse.json(
		{ status: "ok", service: "tastile-web", version: getWebAppVersion(), core: "ok" },
		{ headers: { "cache-control": "no-store" } },
	);
}
