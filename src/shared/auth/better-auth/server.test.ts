import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Regression test for #134: the minimal release must skip the
// email-verification gate so new accounts land directly in the dashboard.
// Future BetterAuth upgrades that re-enable the gate, or that turn off
// autoSignIn, are caught here before they ship.
//
// We read server.ts as text and assert the canonical config fragments are
// present. We deliberately do NOT invoke `getAuth()` because it constructs
// a live BetterAuth instance (Hyperdrive pool + Postgres). If `createAuth`
// drifts away from the minimal-release contract, this test fails.

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_TS = join(HERE, "server.ts");

function readServerSource(): string {
	return readFileSync(SERVER_TS, "utf8");
}

describe("better-auth minimal-release signup config (#134)", () => {
	const source = readServerSource();

	it("disables the email-verification gate at signup", () => {
		expect(source).toMatch(/emailAndPassword:\s*\{[^}]*requireEmailVerification:\s*false/m);
	});

	it("auto-signs in new accounts so the session is immediately usable", () => {
		expect(source).toMatch(/emailAndPassword:\s*\{[^}]*autoSignIn:\s*true/m);
	});

	it("does not send a verification email at signup", () => {
		expect(source).toMatch(/emailVerification:\s*\{[^}]*sendOnSignUp:\s*false/m);
	});

	it("keeps the password reset hook enabled", () => {
		expect(source).toMatch(/emailAndPassword:\s*\{[^}]*enabled:\s*true/m);
	});

	it("does not re-enable requireEmailVerification anywhere in createAuth", () => {
		// Catch a sneaky duplicate that overrides the minimal-release value.
		const matches = source.match(/requireEmailVerification:\s*true/g);
		expect(matches).toBeNull();
	});
});
