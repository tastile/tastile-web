// Mail runtime configuration (Issue #262). Pure parsing — no I/O — so the
// env contract is unit-testable.
//
// Env vars (schema lives in .env.example; values live in Infisical):
//   TASTILE_MAIL_PROVIDER        auto (default) | resend | noop
//   RESEND_API_KEY               Resend API key (secret, Infisical only)
//   TASTILE_MAIL_FROM_ADDRESS    RFC-5322 from header, e.g. "Tastile <noreply@tastile.app>"
//   TASTILE_MAIL_HOURLY_LIMIT    sends per UTC hour   (default 20)
//   TASTILE_MAIL_DAILY_LIMIT     sends per UTC day    (default 90)
//
// Limit rationale: Resend Free is ~100/day and ~3,000/month with no
// automatic paid upgrade. daily=90 keeps a safety margin under 100/day and
// bounds the month to <= ~2,790 sends (< 3,000) even if Resend's own
// accounting drifts. hourly=20 prevents a signup/reset abuse burst from
// draining the daily budget in minutes.

type MailProviderKind = "auto" | "resend" | "noop";

export interface MailRuntimeConfig {
	provider: MailProviderKind;
	resendApiKey: string | null;
	fromAddress: string | null;
	hourlyLimit: number;
	dailyLimit: number;
}

export const DEFAULT_HOURLY_LIMIT = 20;
export const DEFAULT_DAILY_LIMIT = 90;

function parseLimit(raw: string | undefined, fallback: number): number {
	const trimmed = raw?.trim();
	if (!trimmed) return fallback;
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return parsed;
}

export function resolveMailConfig(
	env: Record<string, string | undefined> = process.env,
): MailRuntimeConfig {
	const rawProvider = env.TASTILE_MAIL_PROVIDER?.trim().toLowerCase();
	const provider: MailProviderKind =
		rawProvider === "resend" || rawProvider === "noop" ? rawProvider : "auto";
	return {
		provider,
		resendApiKey: env.RESEND_API_KEY?.trim() || null,
		fromAddress: env.TASTILE_MAIL_FROM_ADDRESS?.trim() || null,
		hourlyLimit: parseLimit(env.TASTILE_MAIL_HOURLY_LIMIT, DEFAULT_HOURLY_LIMIT),
		dailyLimit: parseLimit(env.TASTILE_MAIL_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
	};
}
