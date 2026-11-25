import { Pool } from "pg";

import { resolveAuthDatabaseUrl } from "@/shared/auth/better-auth/database-url";
import { resolveMailConfig } from "./config";
import { FailingMailProvider, NoopMailProvider } from "./providers";
import { PgMailQuotaStore } from "./pg-quota-store";
import type { MailQuotaStore } from "./quota";
import { ResendProvider } from "./resend";
import { MailService } from "./service";
import type { MailProvider } from "./types";

// Runtime wiring for the provider-agnostic mail boundary (Issue #262).
// Selection rules:
//   TASTILE_MAIL_PROVIDER=auto (default): Resend when RESEND_API_KEY is set,
//     otherwise noop (local dev / unit tests keep working without secrets).
//   TASTILE_MAIL_PROVIDER=resend: Resend required; missing key/from address
//     selects the fail-closed provider so misconfiguration errors loudly.
//   TASTILE_MAIL_PROVIDER=noop: always skip delivery.
//
// There is no paid-plan fallback anywhere in this path: Resend Free rejects
// sends past its quota, and our own hourly/daily caps drop sends before they
// reach the provider.

let cachedService: Promise<MailService> | null = null;
let cachedQuotaPool: Pool | null = null;

async function mailDatabaseUrl(): Promise<string | null> {
	const direct = process.env.TASTILE_AUTH_DATABASE_URL;
	let hyperdrive: string | undefined;
	if (!direct?.trim()) {
		const { getCloudflareContext } = await import("@opennextjs/cloudflare");
		const cloudflare = getCloudflareContext();
		hyperdrive = (cloudflare.env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE
			?.connectionString;
	}
	return resolveAuthDatabaseUrl(direct, hyperdrive);
}

async function defaultQuotaStore(): Promise<MailQuotaStore> {
	const connectionString = await mailDatabaseUrl();
	if (!connectionString) {
		throw new Error(
			"[mail] TASTILE_AUTH_DATABASE_URL or HYPERDRIVE is required for the mail quota store",
		);
	}
	if (!cachedQuotaPool) {
		cachedQuotaPool = new Pool({ connectionString, max: 2 });
	}
	return new PgMailQuotaStore(cachedQuotaPool);
}

function selectProvider(config: ReturnType<typeof resolveMailConfig>): MailProvider {
	const wantsResend = config.provider === "resend" || (config.provider === "auto" && config.resendApiKey);
	if (!wantsResend) {
		return config.provider === "resend"
			? new FailingMailProvider("TASTILE_MAIL_PROVIDER=resend but RESEND_API_KEY is unset")
			: new NoopMailProvider();
	}
	if (!config.resendApiKey) {
		return new FailingMailProvider("RESEND_API_KEY is unset");
	}
	if (!config.fromAddress) {
		return new FailingMailProvider("TASTILE_MAIL_FROM_ADDRESS is unset");
	}
	return new ResendProvider({ apiKey: config.resendApiKey, fromAddress: config.fromAddress });
}

async function createMailService(): Promise<MailService> {
	const config = resolveMailConfig();
	const provider = selectProvider(config);
	const quotaStore = provider.quotaExempt ? undefined : await defaultQuotaStore();
	return new MailService({
		provider,
		quotaStore,
		hourlyLimit: config.hourlyLimit,
		dailyLimit: config.dailyLimit,
	});
}

export function getMailService(): Promise<MailService> {
	if (!cachedService) {
		cachedService = createMailService();
	}
	return cachedService;
}
