import { describe, expect, it } from "vitest";
import { generatePkcePair, generateState } from "./pkce";

describe("PKCE", () => {
	it("produces a 43-char base64url verifier and challenge with no padding", async () => {
		const { codeVerifier, codeChallenge } = await generatePkcePair();
		expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(codeVerifier).not.toBe(codeChallenge);
	});

	it("produces different pairs on each call", async () => {
		const a = await generatePkcePair();
		const b = await generatePkcePair();
		expect(a.codeVerifier).not.toBe(b.codeVerifier);
		expect(a.codeChallenge).not.toBe(b.codeChallenge);
	});

	it("state is 22-char base64url", () => {
		const s = generateState();
		expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
	});

	it("state differs across calls", () => {
		const a = generateState();
		const b = generateState();
		expect(a).not.toBe(b);
	});
});
