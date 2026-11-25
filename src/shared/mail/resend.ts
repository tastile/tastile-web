import type { MailMessage, MailProvider } from "./types";

// Resend adapter (Issue #262). Resend Free: ~100 emails/day, ~3,000/month,
// no automatic paid-plan upgrade — the API rejects sends past the free
// quota. Our own caps in MailService keep usage under that ceiling.
//
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export interface ResendProviderOptions {
	apiKey: string;
	/** RFC-5322 from header value, e.g. "Tastile <noreply@tastile.app>". */
	fromAddress: string;
	/** Injectable for tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
}

export class ResendProvider implements MailProvider {
	readonly name = "resend";
	readonly quotaExempt = false;

	private readonly apiKey: string;
	private readonly fromAddress: string;
	private readonly fetchImpl: typeof fetch;

	constructor(options: ResendProviderOptions) {
		this.apiKey = options.apiKey;
		this.fromAddress = options.fromAddress;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async send(message: MailMessage): Promise<void> {
		let response: Response;
		try {
			response = await this.fetchImpl(RESEND_EMAILS_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: this.fromAddress,
					to: [message.to],
					subject: message.subject,
					html: message.html,
				}),
			});
		} catch (err) {
			throw new Error(
				`[mail] resend request failed for "${message.subject}" to ${message.to}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw new Error(
				`[mail] resend rejected "${message.subject}" to ${message.to}: HTTP ${response.status} ${body.slice(0, 300)}`,
			);
		}
	}
}
