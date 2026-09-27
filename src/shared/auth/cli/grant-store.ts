import { Pool } from "pg";

import { ensureWebCliGrantsSchema } from "@/lib/migrations/web-cli-grants";
import { hashGrantCode } from "./pkce";

// Grant store for /api/cli/token (Issue #153, plan D2).
//
// The atomic claim runs in a single statement so concurrent callers cannot
// both win:
//   UPDATE web_cli_auth_grant
//      SET used_at = NOW()
//    WHERE code_hash = $1 AND used_at IS NULL AND expires_at > NOW()
//      AND code_challenge = $2 AND redirect_uri = $3
// RETURNING user_sub, client_id, scopes_effective;
//
// A rowCount === 0 outcome runs a follow-up SELECT to classify the failure
// (invalid_grant / already_used / gone / pkce_mismatch /
// redirect_uri_mismatch).  `pkce_mismatch` and `redirect_uri_mismatch` MUST
// not destroy the grant — only `already_used` should.
//
// `client_id` is NOT in the WHERE clause because the wire contract has no
// `client_id` field; the saved value is verified post-claim against the
// registered client set.

let cachedPool: Pool | null = null;

async function authDatabase(): Promise<Pool> {
  if (!cachedPool) {
    const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "[cli-auth] TASTILE_AUTH_DATABASE_URL is required for the grant store",
      );
    }
    cachedPool = new Pool({ connectionString, max: 5 });
  }
  return cachedPool;
}

async function withPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  // Lazy schema bootstrap on first access — same pattern as
  // src/shared/auth/better-auth/server.ts `authDatabase()`.
  await ensureWebCliGrantsSchema(await authDatabase());
  return fn(await authDatabase());
}

export interface InsertGrantParams {
  /** Plaintext grant code; will be hashed before insert. */
  code: string;
  clientId: string;
  userSub: string;
  /** base64url(SHA-256(verifier)). */
  codeChallenge: string;
  redirectUri: string;
  scopesRequested: string;
  scopesEffective: string;
  ttlSeconds: number;
}

export async function insertGrant(params: InsertGrantParams): Promise<void> {
  await withPool(async (pool) => {
    await pool.query(
      `INSERT INTO web_cli_auth_grant (
         code_hash, client_id, user_sub, code_challenge, redirect_uri,
         scopes_requested, scopes_effective, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + ($8::int * INTERVAL '1 second'))`,
      [
        hashGrantCode(params.code),
        params.clientId,
        params.userSub,
        params.codeChallenge,
        params.redirectUri,
        params.scopesRequested,
        params.scopesEffective,
        params.ttlSeconds,
      ],
    );
  });
}

export type ConsumeResult =
  | {
      status: "ok";
      userSub: string;
      clientId: string;
      scopesEffective: string;
    }
  | { status: "invalid_grant" }
  | { status: "already_used" }
  | { status: "gone" }
  | { status: "pkce_mismatch" }
  | { status: "redirect_uri_mismatch" };

export async function consumeGrantOnce(params: {
  code: string;
  /** base64url(SHA-256(verifier)), pre-computed by the caller. */
  codeChallenge: string;
  redirectUri: string;
}): Promise<ConsumeResult> {
  return withPool(async (pool) => {
    const codeHash = hashGrantCode(params.code);
    const claim = await pool.query<{
      user_sub: string;
      client_id: string;
      scopes_effective: string;
    }>(
      `UPDATE web_cli_auth_grant
          SET used_at = NOW()
        WHERE code_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
          AND code_challenge = $2
          AND redirect_uri = $3
        RETURNING user_sub, client_id, scopes_effective`,
      [codeHash, params.codeChallenge, params.redirectUri],
    );
    if ((claim.rowCount ?? 0) === 1) {
      const row = claim.rows[0]!;
      return {
        status: "ok",
        userSub: row.user_sub,
        clientId: row.client_id,
        scopesEffective: row.scopes_effective,
      };
    }

    const followUp = await pool.query<{
      used_at: Date | null;
      expires_at: Date;
      code_challenge: string;
      redirect_uri: string;
      client_id: string;
    }>(
      `SELECT used_at, expires_at, code_challenge, redirect_uri, client_id
         FROM web_cli_auth_grant
        WHERE code_hash = $1`,
      [codeHash],
    );
    if (followUp.rowCount === 0) {
      return { status: "invalid_grant" };
    }
    const row = followUp.rows[0]!;
    if (row.used_at !== null) {
      return { status: "already_used" };
    }
    if (row.expires_at.getTime() <= Date.now()) {
      return { status: "gone" };
    }
    if (row.code_challenge !== params.codeChallenge) {
      return { status: "pkce_mismatch" };
    }
    if (row.redirect_uri !== params.redirectUri) {
      return { status: "redirect_uri_mismatch" };
    }
    // Should be unreachable: the atomic UPDATE failed but the follow-up
    // SELECT shows the row is un-used, un-expired, with matching challenge
    // and matching redirect_uri. Treat as invalid_grant for safety.
    return { status: "invalid_grant" };
  });
}

export async function markCoreTokenId(
  codeHash: string,
  tokenId: string,
): Promise<void> {
  await withPool(async (pool) => {
    await pool.query(
      `UPDATE web_cli_auth_grant SET core_token_id = $2 WHERE code_hash = $1`,
      [codeHash, tokenId],
    );
  });
}
