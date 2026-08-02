import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const cookieStore: Record<string, { value: string }> = {};
let mockUserSub: string | null = "user-sub-1";
const originalFetch = globalThis.fetch;

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		get: (n: string) => cookieStore[n],
	})),
}));

vi.mock("@/lib/cognito/account-session", () => ({
	getAccountUserSub: vi.fn(async () => mockUserSub),
}));

const { COOKIE_API_TOKEN } = await import("@/shared/auth/cookies");
const {
	ensureDefaultApiTokenForUser,
	getApiTokenFromCookies,
} = await import("./api-token-session");

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("api-token-session bootstrap", () => {
	beforeEach(() => {
		for (const k of Object.keys(cookieStore)) delete cookieStore[k];
		mockUserSub = "user-sub-1";
		process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
		process.env.TASTILE_CORE_URL = "http://core.local:3140";
		delete process.env.NEXT_PUBLIC_TASTILE_CORE_URL;
		delete process.env.NEXT_PUBLIC_DAEMON_BASE_URL;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("returns the existing cookie without making any request", async () => {
		cookieStore[COOKIE_API_TOKEN] = { value: "tst_existing" };
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		expect(await getApiTokenFromCookies()).toBe("tst_existing");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("registers a new token on first login when the server has none", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					id: "tok-1",
					label: "Web session",
					revoked_at: null,
					token: "tst_newtoken",
				}),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const res = NextResponse.json({});
		const token = await ensureDefaultApiTokenForUser("user-sub-1", res);

		expect(token).toBe("tst_newtoken");
		expect(res.cookies.get(COOKIE_API_TOKEN)?.value).toBe("tst_newtoken");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://core.local:3140/v1/api-tokens");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({
			"x-tastile-web-bridge-secret": "test-bridge-secret",
			"x-tastile-web-session-user": "user-sub-1",
			"content-type": "application/json",
		});
		expect(JSON.parse(String(init.body))).toEqual({ label: "Web session" });
	});

	it("registers a new token even when the server already has an active session token (recovery)", async () => {
		// The server returns prior tokens (which is the situation after the
		// cookie has been lost, e.g. user signed in on a new browser or the
		// cookie expired). The bootstrap must NOT skip creation — it must
		// issue a fresh token so the client can authenticate.
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					id: "tok-old",
					label: "Web session",
					revoked_at: null,
					token: "tst_recovered",
				}),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const res = NextResponse.json({});
		const token = await ensureDefaultApiTokenForUser("user-sub-1", res);

		expect(token).toBe("tst_recovered");
		expect(res.cookies.get(COOKIE_API_TOKEN)?.value).toBe("tst_recovered");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not call the LIST endpoint before issuing the token", async () => {
		// There is no "skip-if-default-exists" check any more; the bootstrap
		// always POSTs a new token on login. This is what keeps recovery
		// working when the cookie is lost.
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					id: "tok-1",
					label: "Web session",
					revoked_at: null,
					token: "tst_x",
				}),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await ensureDefaultApiTokenForUser("user-sub-1", NextResponse.json({}));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://core.local:3140/v1/api-tokens");
		expect(init.method).toBe("POST");
	});

	it("returns null and skips fetch when there is no user sub", async () => {
		mockUserSub = null;
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const token = await ensureDefaultApiTokenForUser(null, NextResponse.json({}));

		expect(token).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns null and skips fetch when the bridge secret is missing", async () => {
		delete process.env.TASTILE_WEB_BRIDGE_SECRET;
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const token = await ensureDefaultApiTokenForUser("user-sub-1", NextResponse.json({}));

		expect(token).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
