// Send-quota accounting for transactional mail (Issue #262).
//
// Resend Free allows roughly 100 emails/day and 3,000/month. There is no
// automatic upgrade to a paid plan — exceeding the free quota makes the API
// reject sends — but we still enforce our own caps so that (a) signup/reset
// abuse cannot burn the daily budget in minutes and (b) the monthly ceiling
// stays under the free tier even if Resend's own limits change.
//
// Windows are consumed atomically: `tryConsume` only returns true when EVERY
// window accepted the unit, and rolls back otherwise, so a send is never
// half-counted.

export interface MailQuotaWindow {
	/** Stable bucket key, e.g. "hour:2026-11-25T14" / "day:2026-11-25". */
	key: string;
	/** Maximum sends allowed inside this window. */
	limit: number;
}

export interface MailQuotaStore {
	/**
	 * Atomically consume one send unit from every window.
	 * Returns true when all windows accepted the unit; false when at least
	 * one window is exhausted (nothing is consumed in that case).
	 * Throws when the backing store is unavailable — callers MUST treat a
	 * throw as fail-closed and drop the send.
	 */
	tryConsume(windows: readonly MailQuotaWindow[]): Promise<boolean>;
}
