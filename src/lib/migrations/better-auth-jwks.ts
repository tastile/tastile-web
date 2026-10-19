// Table for the BetterAuth jwt plugin key set (`jwks`, Ed25519 signing keys
// behind the BFF -> tastile-core assertion). Mirrors the plugin schema in
// `better-auth/plugins/jwt`: camelCase quoted columns, the same as the other
// BetterAuth tables in the auth schema.
//
// Bootstrap is lazy and idempotent, the same pattern as web-cli-grants.ts:
// it runs on the first assertion mint, not at module load, so `next build`
// and the login path do not depend on it.

const JWKS_DDL = `
CREATE TABLE IF NOT EXISTS "jwks" (
  "id"         TEXT PRIMARY KEY,
  "publicKey"  TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL,
  "expiresAt"  TIMESTAMPTZ,
  "alg"        TEXT,
  "crv"        TEXT
)`;

let ensured: Promise<void> | null = null;

export function ensureBetterAuthJwksSchema(pool: {
  query(sql: string): Promise<unknown>;
}): Promise<void> {
  if (!ensured) {
    ensured = pool.query(JWKS_DDL).then(
      () => undefined,
      (err: unknown) => {
        // Allow a retry on the next mint instead of caching the failure.
        ensured = null;
        throw err;
      },
    );
  }
  return ensured;
}
