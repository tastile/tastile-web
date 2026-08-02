import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCognitoPublicOrigin } from "./public-origin";

const SAVED_KEY = "NEXT_PUBLIC_APP_URL";

describe("getCognitoPublicOrigin", () => {
	const original = process.env[SAVED_KEY];

	beforeEach(() => {
		delete process.env[SAVED_KEY];
	});

	afterEach(() => {
		if (original === undefined) {
			delete process.env[SAVED_KEY];
		} else {
			process.env[SAVED_KEY] = original;
		}
	});

	it("uses NEXT_PUBLIC_APP_URL when parseable", () => {
		process.env[SAVED_KEY] = "https://app.example.test";
		expect(getCognitoPublicOrigin("https://other.example/path")).toBe(
			"https://app.example.test",
		);
	});

	it("falls through to callbackUrl when NEXT_PUBLIC_APP_URL is missing", () => {
		expect(getCognitoPublicOrigin("https://callback.example/x")).toBe(
			"https://callback.example",
		);
	});

	it("falls through to localhost when both are missing", () => {
		expect(getCognitoPublicOrigin()).toBe("http://localhost:3000");
	});

	it("falls through when NEXT_PUBLIC_APP_URL is the literal placeholder", () => {
		process.env[SAVED_KEY] = "<required>";
		expect(getCognitoPublicOrigin("https://callback.example/x")).toBe(
			"https://callback.example",
		);
	});

	it("falls through when NEXT_PUBLIC_APP_URL is unparseable garbage", () => {
		process.env[SAVED_KEY] = "not a url at all";
		expect(getCognitoPublicOrigin("https://callback.example/x")).toBe(
			"https://callback.example",
		);
	});

	it("falls through when callbackUrl is also unparseable", () => {
		expect(getCognitoPublicOrigin("<<<>>>")).toBe("http://localhost:3000");
	});
});
