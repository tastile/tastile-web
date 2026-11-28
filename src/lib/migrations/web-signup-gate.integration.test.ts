// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { ensureWebSignupGateSchema } from "./web-signup-gate";
import {
	getSignupPolicy,
	issueSignupInvite,
	revokeSignupInvite,
	setSignupPolicy,
} from "@/shared/auth/signup-gate-store";

// Real-Postgres test for the web#258 registration gate.  Runs only when
// TASTILE_AUTH_DATABASE_URL points at a scratch database — CI provides a
// `postgres:16` service; locally use a dedicated test database, never the
// shared auth store.
//
// A minimal `"user"` table stands in for BetterAuth's schema so the
// trigger behaviour can be exercised without booting BetterAuth.

const DB_URL = process.env.TASTILE_AUTH_DATABASE_URL;
const describeIfDb = DB_URL ? describe : describe.skip;

const USER_DDL = `
CREATE TABLE IF NOT EXISTS "user" (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

async function insertUser(pool: Pool, id: string, email: string): Promise<void> {
	await pool.query('INSERT INTO "user" (id, email) VALUES ($1, $2)', [id, email]);
}

describeIfDb("web-signup-gate (real Postgres)", () => {
	let pool: Pool;

	beforeAll(async () => {
		if (!DB_URL) return;
		pool = new Pool({ connectionString: DB_URL });
		await pool.query(USER_DDL);
		await ensureWebSignupGateSchema(pool);
		await pool.query('TRUNCATE "user"');
		await pool.query("TRUNCATE web_signup_invite");
		await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
	});

	afterAll(async () => {
		if (pool) await pool.end().catch(() => undefined);
	});

	it("open policy allows signup without an invite", async () => {
		await insertUser(pool, "u-open-1", "open@example.com");
		const count = await pool.query<{ n: string }>('SELECT count(*) AS n FROM "user"');
		expect(Number(count.rows[0].n)).toBe(1);
	});

	it("invite_required rejects signup without an invite and accepts an invited email once", async () => {
		await setSignupPolicy({ inviteRequired: true, maxUsers: null }, pool);
		try {
			await expect(insertUser(pool, "u-noinv", "noinv@example.com")).rejects.toThrow(
				/signup requires a valid invite/,
			);

			const expires = new Date(Date.now() + 60 * 60 * 1000);
			await issueSignupInvite("Invited@Example.com", expires, pool);
			await insertUser(pool, "u-inv", "invited@example.com");

			// The invite is single-use: a second account for the same email
			// needs a new invite.
			await expect(insertUser(pool, "u-inv2", "invited@example.com")).rejects.toThrow(
				/signup requires a valid invite/,
			);
		} finally {
			await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
		}
	});

	it("rejects expired and revoked invites", async () => {
		await setSignupPolicy({ inviteRequired: true, maxUsers: null }, pool);
		try {
			await issueSignupInvite("expired@example.com", new Date(Date.now() - 1000), pool);
			await expect(insertUser(pool, "u-exp", "expired@example.com")).rejects.toThrow(
				/signup requires a valid invite/,
			);

			const inviteId = await issueSignupInvite(
				"revoked@example.com",
				new Date(Date.now() + 60 * 60 * 1000),
				pool,
			);
			expect(await revokeSignupInvite(inviteId, pool)).toBe(true);
			await expect(insertUser(pool, "u-rev", "revoked@example.com")).rejects.toThrow(
				/signup requires a valid invite/,
			);
		} finally {
			await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
		}
	});

	it("invite consumption rolls back with the user insert", async () => {
		await setSignupPolicy({ inviteRequired: true, maxUsers: null }, pool);
		try {
			await issueSignupInvite("rollback@example.com", new Date(Date.now() + 60 * 60 * 1000), pool);
			// Force the insert to fail after the trigger consumed the invite by
			// violating a constraint on a second statement is not possible
			// inside one INSERT — instead verify the consumed invite row state
			// after a successful insert, then confirm a duplicate email insert
			// (PK conflict path simulated by direct SQL abort) leaves no user.
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				await client.query('INSERT INTO "user" (id, email) VALUES ($1, $2)', [
					"u-rb",
					"rollback@example.com",
				]);
				await client.query("ROLLBACK");
			} finally {
				client.release();
			}
			const user = await pool.query('SELECT 1 FROM "user" WHERE id = $1', ["u-rb"]);
			expect(user.rowCount).toBe(0);
			const invite = await pool.query<{ used_at: Date | null }>(
				"SELECT used_at FROM web_signup_invite WHERE lower(email) = $1",
				["rollback@example.com"],
			);
			expect(invite.rows[0].used_at).toBeNull();
			// And the same invite still works for a real signup.
			await insertUser(pool, "u-rb2", "rollback@example.com");
		} finally {
			await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
		}
	});

	it("max_users caps registration atomically under concurrency", async () => {
		const before = await pool.query<{ n: string }>('SELECT count(*) AS n FROM "user"');
		const cap = Number(before.rows[0].n) + 3;
		await setSignupPolicy({ inviteRequired: false, maxUsers: cap }, pool);
		try {
			const results = await Promise.allSettled(
				Array.from({ length: 8 }, (_, i) =>
					insertUser(pool, `u-cap-${i}`, `cap${i}@example.com`),
				),
			);
			const succeeded = results.filter((r) => r.status === "fulfilled").length;
			const after = await pool.query<{ n: string }>('SELECT count(*) AS n FROM "user"');
			expect(Number(after.rows[0].n)).toBe(cap);
			expect(succeeded).toBe(cap - Number(before.rows[0].n));
			expect(results.some((r) => r.status === "rejected")).toBe(true);
		} finally {
			await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
		}
	});

	it("policy helpers round-trip", async () => {
		await setSignupPolicy({ inviteRequired: true, maxUsers: 42 }, pool);
		const policy = await getSignupPolicy(pool);
		expect(policy).toEqual({ inviteRequired: true, maxUsers: 42 });
		await setSignupPolicy({ inviteRequired: false, maxUsers: null }, pool);
	});
});
