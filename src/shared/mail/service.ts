import type { MailQuotaStore, MailQuotaWindow } from "./quota";
import type { MailMessage, MailProvider, MailSendStatus } from "./types";

// MailService: quota gate + provider dispatch (Issue #262).
//
// Ordering is deliberate — quota is consumed BEFORE the provider call so a
// rejected send never reaches Resend, and a provider failure after quota
// consumption still counts against the window (a retried send re-consumes,
// which is the safe direction for billing protection).
//
// Failure semantics:
//   - quota store error  -> "dropped" (fail closed: no unbounded sends while
//     the counter is unavailable)
//   - quota exhausted    -> "dropped" (free-tier / abuse ceiling reached)
//   - provider error     -> throws (fail closed: caller surfaces the failure
//     instead of silently pretending the mail went out)
//   - quota-exempt provider (noop) -> "skipped" without touching the store

export interface MailServiceDeps {
	provider: MailProvider;
	/** Required unless `provider.quotaExempt` is true. */
	quotaStore?: MailQuotaStore;
	hourlyLimit: number;
	dailyLimit: number;
	/** Injectable clock for tests; defaults to `new Date()`. */
	now?: () => Date;
	log?: {
		info?: (msg: string) => void;
		warn?: (msg: string) => void;
		error?: (msg: string) => void;
	};
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function windowKeys(now: Date): { hourKey: string; dayKey: string } {
	const year = now.getUTCFullYear();
	const month = pad2(now.getUTCMonth() + 1);
	const day = pad2(now.getUTCDate());
	const hour = pad2(now.getUTCHours());
	return {
		hourKey: `hour:${year}-${month}-${day}T${hour}`,
		dayKey: `day:${year}-${month}-${day}`,
	};
}

export class MailService {
	private readonly provider: MailProvider;
	private readonly quotaStore: MailQuotaStore | null;
	private readonly hourlyLimit: number;
	private readonly dailyLimit: number;
	private readonly now: () => Date;
	private readonly log: NonNullable<MailServiceDeps["log"]>;

	constructor(deps: MailServiceDeps) {
		this.provider = deps.provider;
		this.quotaStore = deps.quotaStore ?? null;
		this.hourlyLimit = deps.hourlyLimit;
		this.dailyLimit = deps.dailyLimit;
		this.now = deps.now ?? (() => new Date());
		this.log = deps.log ?? {
			info: (m) => console.info(m),
			warn: (m) => console.warn(m),
			error: (m) => console.error(m),
		};
	}

	async send(message: MailMessage): Promise<MailSendStatus> {
		if (this.provider.quotaExempt) {
			this.log.info?.(
				`[mail] provider "${this.provider.name}" is not configured; skipped "${message.subject}" to ${message.to}`,
			);
			return "skipped";
		}

		const { hourKey, dayKey } = windowKeys(this.now());
		const windows: MailQuotaWindow[] = [
			{ key: hourKey, limit: this.hourlyLimit },
			{ key: dayKey, limit: this.dailyLimit },
		];

		if (!this.quotaStore) {
			this.log.error?.(
				`[mail] no quota store configured for provider "${this.provider.name}"; dropping "${message.subject}" to ${message.to} (fail closed)`,
			);
			return "dropped";
		}

		let withinQuota: boolean;
		try {
			withinQuota = await this.quotaStore.tryConsume(windows);
		} catch (err) {
			this.log.error?.(
				`[mail] quota store unavailable; dropping "${message.subject}" to ${message.to} (fail closed): ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
			return "dropped";
		}
		if (!withinQuota) {
			this.log.warn?.(
				`[mail] send quota exhausted (${this.provider.name}); dropped "${message.subject}" to ${message.to} (hour<=${this.hourlyLimit}, day<=${this.dailyLimit})`,
			);
			return "dropped";
		}

		try {
			await this.provider.send(message);
		} catch (err) {
			this.log.error?.(
				`[mail] provider "${this.provider.name}" failed for "${message.subject}" to ${message.to}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
			throw err;
		}
		return "sent";
	}
}
