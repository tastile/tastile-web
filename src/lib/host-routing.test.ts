import { beforeEach, describe, expect, it } from "vitest";

import { resolveCanonicalHostRedirect } from "./host-routing";

// The open-source build reads the apex + app hosts from env vars. The
// tests pin them to `example.test` fixtures so the suite never depends
// on the live production host strings.
const APEX_HOST = "example.test";
const APP_HOST = "app.example.test";

beforeEach(() => {
  process.env.NEXT_PUBLIC_APEX_HOST = APEX_HOST;
  process.env.NEXT_PUBLIC_APP_HOST = APP_HOST;
});

describe("resolveCanonicalHostRedirect", () => {
	it("keeps app routes on the configured app host", () => {
		expect(
			resolveCanonicalHostRedirect(APEX_HOST, "/dashboard/account"),
		).toBe(APP_HOST);
		expect(resolveCanonicalHostRedirect(APEX_HOST, "/auth/callback")).toBe(
			APP_HOST,
		);
		expect(resolveCanonicalHostRedirect(APEX_HOST, "/login")).toBe(
			APP_HOST,
		);
		expect(
			resolveCanonicalHostRedirect(APEX_HOST, "/api/account/profile"),
		).toBe(APP_HOST);
	});

	it("keeps public website routes on the configured app host", () => {
		expect(resolveCanonicalHostRedirect(APP_HOST, "/")).toBeNull();
		expect(resolveCanonicalHostRedirect(APP_HOST, "/pricing")).toBeNull();
		expect(resolveCanonicalHostRedirect(APP_HOST, "/download")).toBeNull();
		expect(resolveCanonicalHostRedirect(APP_HOST, "/privacy")).toBeNull();
	});

	it("does not redirect public APIs or already canonical routes", () => {
		expect(
			resolveCanonicalHostRedirect(APEX_HOST, "/api/version"),
		).toBeNull();
		expect(
			resolveCanonicalHostRedirect(APEX_HOST, "/api/download/windows"),
		).toBeNull();
		expect(
			resolveCanonicalHostRedirect(APP_HOST, "/dashboard"),
		).toBeNull();
		expect(resolveCanonicalHostRedirect(APEX_HOST, "/download")).toBeNull();
	});
});
