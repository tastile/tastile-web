import { Pool } from "pg";

import { ensureWebSignupGateSchema } from "@/lib/migrations/web-signup-gate";

// Admin-facing store for the registration gate (Issue web#258).  The gate
// itself is enforced by the `web_signup_gate()` trigger installed by
// `ensureWebSignupGateSchema`; these helpers only manage policy rows and
// invite issuance.  Invite issuance is deliberately a server-side store
// operation — there is no public endpoint, so invites cannot be self-issued.

export interface SignupPolicy {
	inviteRequired: boolean;
	maxUsers: number | null;
}

let cachedPool: Pool | null = null;

function authDatabase(): Pool {
	if (!cachedPool) {
		const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
		if (!connectionString) {
			throw new Error(
				"[signup-gate] TASTILE_AUTH_DATABASE_URL is required for the signup gate store",
			);
		}
		cachedPool = new Pool({ connectionString, max: 2 });
	}
	return cachedPool;
}

export async function getSignupPolicy(pool?: Pool): Promise<SignupPolicy> {
	const target = pool ?? authDatabase();
	await ensureWebSignupGateSchema(target);
	const result = await target.query<{
		invite_required: boolean;
		max_users: string | number | null;
	}>("SELECT invite_required, max_users FROM web_signup_policy WHERE id = 1");
	const row = result.rows[0];
	if (!row) {
		return { inviteRequired: false, maxUsers: null };
	}
	return {
		inviteRequired: row.invite_required,
		maxUsers: row.max_users === null ? null : Number(row.max_users),
	};
}

export async function setSignupPolicy(
	policy: SignupPolicy,
	pool?: Pool,
): Promise<void> {
	const target = pool ?? authDatabase();
	await ensureWebSignupGateSchema(target);
	await target.query(
		`INSERT INTO web_signup_policy (id, invite_required, max_users, updated_at)
		 VALUES (1, $1, $2, now())
		 ON CONFLICT (id) DO UPDATE SET
		   invite_required = EXCLUDED.invite_required,
		   max_users = EXCLUDED.max_users,
		   updated_at = now()`,
		[policy.inviteRequired, policy.maxUsers],
	);
}

// Issue a single-use invite for `email`.  Any still-live invite for the
// same address is revoked first so the partial unique index on active
// invites holds; used and already-revoked rows are kept as history.
// Returns the invite id.
export async function issueSignupInvite(
	email: string,
	expiresAt: Date,
	pool?: Pool,
): Promise<string> {
	const target = pool ?? authDatabase();
	await ensureWebSignupGateSchema(target);
	const normalized = email.trim().toLowerCase();
	const client = await target.connect();
	try {
		await client.query("BEGIN");
		await client.query(
			`UPDATE web_signup_invite
			    SET revoked_at = now()
			  WHERE lower(email) = $1
			    AND used_at IS NULL
			    AND revoked_at IS NULL`,
			[normalized],
		);
		const inserted = await client.query<{ id: string }>(
			`INSERT INTO web_signup_invite (email, expires_at)
			 VALUES ($1, $2)
			 RETURNING id`,
			[normalized, expiresAt.toISOString()],
		);
		await client.query("COMMIT");
		return inserted.rows[0].id;
	} catch (err) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw err;
	} finally {
		client.release();
	}
}

export async function revokeSignupInvite(
	inviteId: string,
	pool?: Pool,
): Promise<boolean> {
	const target = pool ?? authDatabase();
	await ensureWebSignupGateSchema(target);
	const result = await target.query(
		`UPDATE web_signup_invite
		    SET revoked_at = now()
		  WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
		[inviteId],
	);
	return (result.rowCount ?? 0) > 0;
}
