import { getMailService } from "@/shared/mail/runtime";

// Transactional auth email delivery (ADR 2026-08-22: Cognito → BetterAuth;
// Issue #262: SES → provider-agnostic mail boundary with Resend adapter).
//
// Delivery goes through `MailService`, which enforces hourly/daily send
// quotas before delegating to the configured provider (Resend Free first
// candidate). When no provider is configured (local dev / unit tests) the
// send is skipped; if the caller supplies `devUrl` the actionable link is
// printed instead so the flow stays usable without mail credentials.

export async function sendAuthEmail(args: {
	to: string;
	subject: string;
	html: string;
	/** Verification/reset link surfaced in logs when mail is not delivered. */
	devUrl?: string;
}): Promise<void> {
	const service = await getMailService();
	const status = await service.send({
		to: args.to,
		subject: args.subject,
		html: args.html,
	});
	if (status !== "sent" && args.devUrl) {
		console.info(`[auth-email] DEV LINK (${args.to}): ${args.devUrl}`);
	}
}

export function verificationEmailHtml(url: string): string {
	return `<p>Welcome to Tastile.</p><p>Confirm your email address:</p><p><a href="${url}">${url}</a></p><p>This link expires when a newer one is requested.</p>`;
}

export function passwordResetEmailHtml(url: string): string {
	return `<p>A password reset was requested for your Tastile account.</p><p><a href="${url}">${url}</a></p><p>If this wasn't you, ignore this message.</p>`;
}
