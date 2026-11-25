import { describe, expect, it, vi } from "vitest";

import { resolveMailConfig, DEFAULT_DAILY_LIMIT, DEFAULT_HOURLY_LIMIT } from "./config";
import { FailingMailProvider, NoopMailProvider } from "./providers";
import { InMemoryMailQuotaStore, PgMailQuotaStore } from "./pg-quota-store";
import type { MailQuotaStore } from "./quota";
import { ResendProvider } from "./resend";
import { MailService } from "./service";
import type { MailMessage, MailProvider } from "./types";

const MESSAGE: MailMessage = {
	to: "user@example.com",
	subject: "Reset your Tastile password",
	html: "<p>reset</p>",
};

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function fakeProvider(overrides: Partial<MailProvider> = {}): MailProvider & {
	send: ReturnType<typeof vi.fn>;
} {
	return {
		name: "fake",
		quotaExempt: false,
		send: vi.fn(async () => undefined),
		...overrides,
	} as MailProvider & { send: ReturnType<typeof vi.fn> };
}

describe("resolveMailConfig", () => {
	it("defaults to auto provider with Resend free-tier-safe limits", () => {
		const config = resolveMailConfig({});
		expect(config.provider).toBe("auto");
		expect(config.resendApiKey).toBeNull();
		expect(config.fromAddress).toBeNull();
		expect(config.hourlyLimit).toBe(DEFAULT_HOURLY_LIMIT);
		expect(config.dailyLimit).toBe(DEFAULT_DAILY_LIMIT);
		// Resend Free is ~100/day, ~3000/month; defaults must stay under it.
		expect(config.dailyLimit).toBeLessThan(100);
		expect(config.dailyLimit * 31).toBeLessThan(3000);
	});

	it("reads overrides and rejects invalid limits", () => {
		const config = resolveMailConfig({
			TASTILE_MAIL_PROVIDER: "Resend",
			RESEND_API_KEY: "re_test",
			TASTILE_MAIL_FROM_ADDRESS: "Tastile <noreply@tastile.app>",
			TASTILE_MAIL_HOURLY_LIMIT: "5",
			TASTILE_MAIL_DAILY_LIMIT: "not-a-number",
		});
		expect(config.provider).toBe("resend");
		expect(config.resendApiKey).toBe("re_test");
		expect(config.fromAddress).toBe("Tastile <noreply@tastile.app>");
		expect(config.hourlyLimit).toBe(5);
		expect(config.dailyLimit).toBe(DEFAULT_DAILY_LIMIT);
	});
});

describe("ResendProvider", () => {
	it("POSTs to the Resend emails API with bearer auth and JSON body", async () => {
		const fetchImpl = vi.fn(async () => new Response('{"id":"email_1"}', { status: 200 }));
		const provider = new ResendProvider({
			apiKey: "re_secret",
			fromAddress: "Tastile <noreply@tastile.app>",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await provider.send(MESSAGE);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer re_secret");
		expect(JSON.parse(String(init.body))).toEqual({
			from: "Tastile <noreply@tastile.app>",
			to: ["user@example.com"],
			subject: MESSAGE.subject,
			html: MESSAGE.html,
		});
	});

	it("throws on non-2xx responses (fail closed)", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("quota exceeded", { status: 429 }),
		);
		const provider = new ResendProvider({
			apiKey: "re_secret",
			fromAddress: "Tastile <noreply@tastile.app>",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await expect(provider.send(MESSAGE)).rejects.toThrow(/HTTP 429/);
	});

	it("throws on network failure", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("socket hangup");
		});
		const provider = new ResendProvider({
			apiKey: "re_secret",
			fromAddress: "Tastile <noreply@tastile.app>",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await expect(provider.send(MESSAGE)).rejects.toThrow(/socket hangup/);
	});
});

describe("MailService", () => {
	const fixedNow = new Date("2026-11-25T14:30:00Z");

	function serviceWith(
		provider: MailProvider,
		quotaStore: MailQuotaStore = new InMemoryMailQuotaStore(),
	) {
		return new MailService({
			provider,
			quotaStore,
			hourlyLimit: 2,
			dailyLimit: 3,
			now: () => fixedNow,
			log: silentLog,
		});
	}

	it("sends through the provider when quota allows", async () => {
		const provider = fakeProvider();
		const service = serviceWith(provider);
		const status = await service.send(MESSAGE);
		expect(status).toBe("sent");
		expect(provider.send).toHaveBeenCalledWith(MESSAGE);
	});

	it("consumes both hourly and daily windows with UTC bucket keys", async () => {
		const store = new InMemoryMailQuotaStore();
		const tryConsume = vi.spyOn(store, "tryConsume");
		const service = serviceWith(fakeProvider(), store);
		await service.send(MESSAGE);
		expect(tryConsume).toHaveBeenCalledWith([
			{ key: "hour:2026-11-25T14", limit: 2 },
			{ key: "day:2026-11-25", limit: 3 },
		]);
	});

	it("drops without calling the provider when quota is exhausted", async () => {
		const provider = fakeProvider();
		const store: InMemoryMailQuotaStore = new InMemoryMailQuotaStore();
		// Exhaust the hourly window (service hourlyLimit = 2) directly.
		const hourWindow = [{ key: "hour:2026-11-25T14", limit: 2 }];
		await store.tryConsume(hourWindow);
		await store.tryConsume(hourWindow);
		const service = serviceWith(provider, store);
		const status = await service.send(MESSAGE);
		expect(status).toBe("dropped");
		expect(provider.send).not.toHaveBeenCalled();
		expect(silentLog.warn).toHaveBeenCalled();
	});

	it("fails closed when the quota store throws", async () => {
		const provider = fakeProvider();
		const store = {
			tryConsume: vi.fn(async () => {
				throw new Error("db down");
			}),
		};
		const service = serviceWith(provider, store);
		const status = await service.send(MESSAGE);
		expect(status).toBe("dropped");
		expect(provider.send).not.toHaveBeenCalled();
		expect(silentLog.error).toHaveBeenCalled();
	});

	it("fails closed when no quota store is configured", async () => {
		const provider = fakeProvider();
		const service = new MailService({
			provider,
			quotaStore: undefined,
			hourlyLimit: 2,
			dailyLimit: 3,
			now: () => fixedNow,
			log: silentLog,
		});
		const status = await service.send(MESSAGE);
		expect(status).toBe("dropped");
		expect(provider.send).not.toHaveBeenCalled();
	});

	it("propagates provider failures (fail closed)", async () => {
		const provider = fakeProvider({
			send: vi.fn(async () => {
				throw new Error("resend HTTP 500");
			}),
		});
		const service = serviceWith(provider);
		await expect(service.send(MESSAGE)).rejects.toThrow("resend HTTP 500");
	});

	it("skips quota accounting for quota-exempt providers", async () => {
		const store = { tryConsume: vi.fn(async () => true) };
		const service = serviceWith(new NoopMailProvider(), store);
		const status = await service.send(MESSAGE);
		expect(status).toBe("skipped");
		expect(store.tryConsume).not.toHaveBeenCalled();
	});

	it("lets fail-closed misconfiguration providers surface their error", async () => {
		const provider = new FailingMailProvider("RESEND_API_KEY is unset");
		const service = serviceWith(provider);
		await expect(service.send(MESSAGE)).rejects.toThrow(/RESEND_API_KEY is unset/);
	});
});

describe("InMemoryMailQuotaStore", () => {
	it("enforces per-window limits atomically", async () => {
		const store = new InMemoryMailQuotaStore();
		const windows = [
			{ key: "hour:h1", limit: 1 },
			{ key: "day:d1", limit: 2 },
		];
		expect(await store.tryConsume(windows)).toBe(true);
		// Hourly exhausted; day still has room -> whole consume rejected.
		expect(await store.tryConsume(windows)).toBe(false);
		expect(store.countFor("hour:h1")).toBe(1);
		expect(store.countFor("day:d1")).toBe(1);
	});
});

describe("PgMailQuotaStore", () => {
	function fakePool(scriptedSent: number[]) {
		const queries: string[] = [];
		const client = {
			query: vi.fn(async (text: string) => {
				queries.push(text);
				if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
					return { rows: [] };
				}
				return { rows: [{ sent: scriptedSent.shift() ?? 0 }] };
			}),
			release: vi.fn(),
		};
		return {
			queries,
			pool: {
				query: vi.fn(async () => ({ rows: [] })),
				connect: vi.fn(async () => client),
			} as unknown as ConstructorParameters<typeof PgMailQuotaStore>[0],
		};
	}

	it("commits when every window is within limit", async () => {
		const { pool, queries } = fakePool([1, 2]);
		const store = new PgMailQuotaStore(pool);
		const ok = await store.tryConsume([
			{ key: "hour:h", limit: 5 },
			{ key: "day:d", limit: 5 },
		]);
		expect(ok).toBe(true);
		expect(queries).toContain("COMMIT");
		expect(queries).not.toContain("ROLLBACK");
	});

	it("rolls back when any window exceeds its limit", async () => {
		const { pool, queries } = fakePool([1, 6]);
		const store = new PgMailQuotaStore(pool);
		const ok = await store.tryConsume([
			{ key: "hour:h", limit: 5 },
			{ key: "day:d", limit: 5 },
		]);
		expect(ok).toBe(false);
		expect(queries).toContain("ROLLBACK");
		expect(queries).not.toContain("COMMIT");
	});
});
