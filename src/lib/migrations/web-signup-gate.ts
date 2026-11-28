import { Pool } from "pg";

// Single-transaction migration for the registration gate (Issue web#258,
// root#141 NF04-W07).  Three tables + one trigger function + a conditional
// trigger on BetterAuth's `user` table, all inside one transaction.
//
// Enforcement is a BEFORE INSERT trigger on `"user"`: invite consumption
// and the registration cap check run inside the same transaction as the
// user row insert, so a failed signup rolls the invite consumption and
// the slot check back with it — no leaked invites or slots.  Because the
// gate lives in the database, every BetterAuth signup entry point
// (email/password, social callbacks, future providers) is covered without
// per-endpoint hook logic.
//
// Bootstrap is lazy on first module access (same pattern as
// src/lib/migrations/web-cli-grants.ts).  The trigger is only installed
// when `to_regclass('user')` resolves — BetterAuth creates its schema on
// first handler use, so `ensureWebSignupGateSchema` is re-run lazily from
// the auth before-hook on signup paths until the table exists.
//
// The runtime migration assumes the BetterAuth role has CREATE on the
// current schema and owns the `user` table (same assumption as
// web-cli-grants; verified per plan A.6 there).

const MIGRATION_VERSION = "V1__web_signup_gate";

let cachedPool: Pool | null = null;

function authDatabase(): Pool {
	if (!cachedPool) {
		const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
		if (!connectionString) {
			throw new Error(
				"[signup-gate] TASTILE_AUTH_DATABASE_URL is required for the signup gate migration",
			);
		}
		cachedPool = new Pool({ connectionString, max: 2 });
	}
	return cachedPool;
}

const POLICY_DDL = `
CREATE TABLE IF NOT EXISTS web_signup_policy (
  id             SMALLINT PRIMARY KEY CHECK (id = 1),
  invite_required BOOLEAN NOT NULL DEFAULT false,
  max_users      BIGINT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const POLICY_SEED_DDL = `
INSERT INTO web_signup_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

const INVITE_DDL = `
CREATE TABLE IF NOT EXISTS web_signup_invite (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// At most one live invite per email; historical used/revoked rows do not
// block re-issue.
const INVITE_ACTIVE_EMAIL_INDEX_DDL = `
CREATE UNIQUE INDEX IF NOT EXISTS web_signup_invite_active_email_idx
  ON web_signup_invite (lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL`;

const GATE_FUNCTION_DDL = `
CREATE OR REPLACE FUNCTION web_signup_gate() RETURNS trigger AS $fn$
DECLARE
  pol          web_signup_policy%ROWTYPE;
  user_count   BIGINT;
BEGIN
  SELECT * INTO pol FROM web_signup_policy WHERE id = 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF pol.invite_required THEN
    UPDATE web_signup_invite
       SET used_at = now()
     WHERE lower(email) = lower(NEW.email)
       AND used_at IS NULL
       AND revoked_at IS NULL
       AND expires_at > now();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'signup requires a valid invite for this email address'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF pol.max_users IS NOT NULL THEN
    -- Serialize concurrent signups so the cap check is exact: without the
    -- advisory lock two inserts could both observe count = cap - 1.
    PERFORM pg_advisory_xact_lock(7272001);
    SELECT count(*) INTO user_count FROM "user";
    IF user_count >= pol.max_users THEN
      RAISE EXCEPTION 'registration limit reached'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql`;

// CREATE OR REPLACE TRIGGER requires PostgreSQL 14+ (CI/local run 16).
// The DO block skips installation while BetterAuth's `user` table does
// not exist yet; re-running ensure installs it once the table appears.
const TRIGGER_INSTALL_DDL = `
DO $do$
BEGIN
  IF to_regclass('user') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE TRIGGER web_signup_gate_trg
               BEFORE INSERT ON "user"
               FOR EACH ROW EXECUTE FUNCTION web_signup_gate()';
  END IF;
END
$do$`;

const MIGRATION_VERSION_DDL = `
CREATE TABLE IF NOT EXISTS web_signup_gate_migration (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export async function ensureWebSignupGateSchema(pool?: Pool): Promise<void> {
	const target = pool ?? authDatabase();
	const client = await target.connect();
	try {
		await client.query("BEGIN");
		await client.query(MIGRATION_VERSION_DDL);
		await client.query(POLICY_DDL);
		await client.query(POLICY_SEED_DDL);
		await client.query(INVITE_DDL);
		await client.query(INVITE_ACTIVE_EMAIL_INDEX_DDL);
		await client.query(GATE_FUNCTION_DDL);
		await client.query(TRIGGER_INSTALL_DDL);
		await client.query(
			"INSERT INTO web_signup_gate_migration (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
			[MIGRATION_VERSION],
		);
		await client.query("COMMIT");
	} catch (err) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw err;
	} finally {
		client.release();
	}
}
