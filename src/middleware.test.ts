import { describe, expect, it } from "vitest";
import { isNativeAuthReturnRequest } from "./middleware";

describe("middleware native auth return detection", () => {
	it("detects native app auth requests that must not bounce to dashboard", () => {
		const params = new URLSearchParams({
			redirect_uri: "tastile://auth/callback",
			state: "native-state-123456",
			code_challenge: "native-challenge-123456",
		});

		expect(isNativeAuthReturnRequest(params)).toBe(true);
	});

	it("does not treat normal web auth pages as native app returns", () => {
		expect(isNativeAuthReturnRequest(new URLSearchParams())).toBe(false);
		expect(
			isNativeAuthReturnRequest(
				new URLSearchParams({
					redirect_uri: "https://app.tastile.app/auth/callback",
					state: "web-state-123456",
				}),
			),
		).toBe(false);
	});
});
