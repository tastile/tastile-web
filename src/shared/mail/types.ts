// Provider-agnostic transactional mail boundary (Issue #262).
//
// Business code (BetterAuth hooks today) talks to `MailService`, never to a
// provider SDK. Providers are adapters behind `MailProvider`; the service
// enforces send quotas BEFORE delegating so a misconfigured or abused caller
// cannot exceed the upstream free-tier ceiling and trigger paid usage.

export interface MailMessage {
	to: string;
	subject: string;
	html: string;
}

export type MailSendStatus =
	| "sent"
	| "skipped"
	| "dropped"
;

export interface MailProvider {
	readonly name: string;
	/**
	 * `true` for providers that never deliver real mail (noop stubs).
	 * The service skips quota accounting for them. Providers that throw on
	 * every send (fail-closed misconfiguration stubs) keep this `false` so
	 * the error still surfaces.
	 */
	readonly quotaExempt: boolean;
	/**
	 * Deliver the message. Implementations MUST throw on delivery failure so
	 * the caller can surface a fail-closed error instead of silently
	 * dropping mail.
	 */
	send(message: MailMessage): Promise<void>;
}
