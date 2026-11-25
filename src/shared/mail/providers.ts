import type { MailMessage, MailProvider } from "./types";

// No-op provider for local dev / environments without mail credentials.
// Preserves the pre-#262 behavior: when no mail provider is configured the
// send is skipped and the caller logs the actionable dev link instead.

export class NoopMailProvider implements MailProvider {
	readonly name = "noop";
	readonly quotaExempt = true;

	async send(_message: MailMessage): Promise<void> {
		// Intentionally empty — MailService short-circuits before this runs.
	}
}

// Fail-closed provider: selected when mail delivery was explicitly
// configured (TASTILE_MAIL_PROVIDER=resend) but required settings are
// missing. Every send throws so misconfiguration surfaces immediately
// instead of silently dropping auth email.
export class FailingMailProvider implements MailProvider {
	readonly name = "failing";
	readonly quotaExempt = false;

	constructor(private readonly reason: string) {}

	async send(message: MailMessage): Promise<void> {
		throw new Error(`[mail] ${this.reason}; cannot send "${message.subject}" to ${message.to}`);
	}
}
