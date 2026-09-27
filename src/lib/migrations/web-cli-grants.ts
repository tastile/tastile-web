import { Pool } from "pg";

// Single-transaction migration for the /cli/authorize + /api/cli/token flow
// (Issue #153, plan D1 + D6.1).  Two tables + two partial indexes + a
// version row, all created inside one transaction so a crash between DDL and
// the version-insert cannot leave a half-applied schema.
//
// Bootstrap is **lazy on first module access** (same pattern as
// src/shared/auth/better-auth/server.ts `authDatabase()`): the migration
// does not run at module top-level, so `next build` without
// TASTILE_AUTH_DATABASE_URL does not crash.
//
// The runtime migration assumes the BetterAuth role has CREATE on the
// current schema (verified per plan A.6).  If staging rejects CREATE the
// migration is moved to a deploy-time script and this becomes a no-op
// (CREATE TABLE IF NOT EXISTS remains safe).

const MIGRATION_VERSION = "V1__web_cli_auth_grant";

let cachedPool: Pool | null = null;

function authDatabase(): Pool {
  if (!cachedPool) {
    const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "[cli-auth] TASTILE_AUTH_DATABASE_URL is required for the CLI auth migration",
      );
    }
    cachedPool = new Pool({ connectionString, max: 2 });
  }
  return cachedPool;
}

const GRANT_DDL = `
CREATE TABLE IF NOT EXISTS web_cli_auth_grant (
  code_hash        TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL,
  user_sub         TEXT NOT NULL,
  code_challenge   TEXT NOT NULL,
  redirect_uri     TEXT NOT NULL,
  scopes_requested TEXT NOT NULL,
  scopes_effective TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  core_token_id    TEXT
)`;

const GRANT_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS web_cli_auth_grant_expires_at_idx
  ON web_cli_auth_grant(expires_at) WHERE used_at IS NULL`;

const PENDING_CONSENT_DDL = `
CREATE TABLE IF NOT EXISTS web_cli_auth_pending_consent (
  id               UUID PRIMARY KEY,
  user_sub         TEXT NOT NULL,
  client_id        TEXT NOT NULL,
  code_challenge   TEXT NOT NULL,
  redirect_uri     TEXT NOT NULL,
  scopes_requested TEXT NOT NULL,
  scopes_effective TEXT NOT NULL,
  state            TEXT NOT NULL,
  response_type    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  consumed_at      TIMESTAMPTZ
)`;

const PENDING_CONSENT_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS web_cli_auth_pending_consent_expires_at_idx
  ON web_cli_auth_pending_consent(expires_at) WHERE consumed_at IS NULL`;

const MIGRATION_VERSION_DDL = `
CREATE TABLE IF NOT EXISTS web_cli_auth_migration (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export async function ensureWebCliGrantsSchema(pool?: Pool): Promise<void> {
  const target = pool ?? authDatabase();
  const client = await target.connect();
  try {
    await client.query("BEGIN");
    await client.query(MIGRATION_VERSION_DDL);
    await client.query(GRANT_DDL);
    await client.query(GRANT_INDEX_DDL);
    await client.query(PENDING_CONSENT_DDL);
    await client.query(PENDING_CONSENT_INDEX_DDL);
    await client.query(
      "INSERT INTO web_cli_auth_migration (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
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
