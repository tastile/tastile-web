import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore: Record<
	string,
	{ value: string; options: Record<string, unknown> }
> = {};

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		get: (n: string) => cookieStore[n],
		set: (n: string, v: string, o: Record<string, unknown>) => {
			cookieStore[n] = { value: v, options: o };
		},
	})),
}));

import {
	COOKIE_ACCESS_TOKEN,
	COOKIE_ID_TOKEN,
	COOKIE_REFRESH_TOKEN,
	COOKIE_USER_SUB,
	clearAuthCookies,
	getIdTokenFromCookies,
	getRefreshTokenFromCookies,
	getUserSubFromCookies,
	setAuthCookies,
} from "./cookies";

describe("cognito cookies", () => {
	beforeEach(() => {
		for (const k of Object.keys(cookieStore)) delete cookieStore[k];
	});

	it("sets auth cookies with httpOnly + sameSite=lax", async () => {
		await setAuthCookies({
			idToken: "id",
			accessToken: "access",
			refreshToken: "ref",
			sub: "sub-1",
			expiresIn: 3600,
		});
		expect(cookieStore[COOKIE_ID_TOKEN].value).toBe("id");
		expect(cookieStore[COOKIE_ID_TOKEN].options.httpOnly).toBe(true);
		expect(cookieStore[COOKIE_ID_TOKEN].options.sameSite).toBe("lax");
		expect(cookieStore[COOKIE_ID_TOKEN].options.path).toBe("/");
		expect(cookieStore[COOKIE_ID_TOKEN].options.maxAge).toBe(3600);
		expect(cookieStore[COOKIE_ACCESS_TOKEN].value).toBe("access");
		expect(cookieStore[COOKIE_REFRESH_TOKEN].value).toBe("ref");
		expect(cookieStore[COOKIE_USER_SUB].value).toBe("sub-1");
	});

	it("omits refresh cookie when refreshToken is null", async () => {
		await setAuthCookies({
			idToken: "id",
			refreshToken: null,
			sub: "sub-1",
			expiresIn: 3600,
		});
		expect(cookieStore[COOKIE_ID_TOKEN]).toBeDefined();
		expect(cookieStore[COOKIE_REFRESH_TOKEN]).toBeUndefined();
		expect(cookieStore[COOKIE_USER_SUB]).toBeDefined();
	});

	it("clears all auth cookies", async () => {
		await setAuthCookies({
			idToken: "i",
			accessToken: "a",
			refreshToken: "r",
			sub: "s",
			expiresIn: 60,
		});
		await clearAuthCookies();
		expect(cookieStore[COOKIE_ID_TOKEN].options.maxAge).toBe(0);
		expect(cookieStore[COOKIE_ACCESS_TOKEN].options.maxAge).toBe(0);
		expect(cookieStore[COOKIE_REFRESH_TOKEN].options.maxAge).toBe(0);
		expect(cookieStore[COOKIE_USER_SUB].options.maxAge).toBe(0);
	});

	it("reads id_token", async () => {
		await setAuthCookies({
			idToken: "my-id",
			refreshToken: null,
			sub: "sub",
			expiresIn: 60,
		});
		expect(await getIdTokenFromCookies()).toBe("my-id");
	});

	it("reads refresh_token and sub", async () => {
		await setAuthCookies({
			idToken: "i",
			refreshToken: "my-ref",
			sub: "my-sub",
			expiresIn: 60,
		});
		expect(await getRefreshTokenFromCookies()).toBe("my-ref");
		expect(await getUserSubFromCookies()).toBe("my-sub");
	});

	it("returns null when cookies are not set", async () => {
		expect(await getIdTokenFromCookies()).toBeNull();
		expect(await getRefreshTokenFromCookies()).toBeNull();
		expect(await getUserSubFromCookies()).toBeNull();
	});
});
