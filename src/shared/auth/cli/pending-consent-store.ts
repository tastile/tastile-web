import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { ensureWebCliGrantsSchema } from "@/lib/migrations/web-cli-grants";

// DB-backed pending consent for /cli/authorize (Issue #153, plan D6 + D6.1).
//
// HMAC form tokens would expand the secret surface (a second key alongside
// TASTILE_WEB_BRIDGE_SECRET) and would not capture user_sub at GET-time,
// forcing the POST handler to re-resolve the session anyway. The DB row
// captures both the params and the user identity atomically, eliminating a
// class of bugs around session swap between GET and POST.
//
// `consumed_at` is the replay-defense column: the POST handler updates it
// conditionally (WHERE consumed_at IS NULL) so a second POST with the same
// `tid` sees `markPendingConsumed` return `false` and can 410.

let cachedPool: Pool | null = null;

async function authDatabase(): Promise<Pool> {
  if (!cachedPool) {
    const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "[cli-auth] TASTILE_AUTH_DATABASE_URL is required for the pending consent store",
      );
    }
    cachedPool = new Pool({ connectionString, max: 5 });
  }
  return cachedPool;
}

async function withPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  await ensureWebCliGrantsSchema(await authDatabase());
  return fn(await authDatabase());
}

export interface InsertPendingConsentParams {
  userSub: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopesRequested: string;
  scopesEffective: string;
  state: string;
  responseType: string;
  ttlSeconds: number;
}

export async function insertPendingConsent(
  params: InsertPendingConsentParams,
): Promise<string> {
  return withPool(async (pool) => {
    // UUIDv4 — the row only needs uniqueness, not time-orderable semantics.
    // v7 would be a better default (k-sortable, smaller index pages) but
    // Node's `randomUUID` is v4 and the table is short-lived so the choice
    // is documented but not load-bearing.
    const id = randomUUID();
    await pool.query(
      `INSERT INTO web_cli_auth_pending_consent (
         id, user_sub, client_id, code_challenge, redirect_uri,
         scopes_requested, scopes_effective, state, response_type, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + ($10::int * INTERVAL '1 second'))`,
      [
        id,
        params.userSub,
        params.clientId,
        params.codeChallenge,
        params.redirectUri,
        params.scopesRequested,
        params.scopesEffective,
        params.state,
        params.responseType,
        params.ttlSeconds,
      ],
    );
    return id;
  });
}

export type PendingConsent =
  | {
      status: "ok";
      userSub: string;
      clientId: string;
      codeChallenge: string;
      redirectUri: string;
      scopesEffective: string;
      state: string;
      responseType: string;
    }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "consumed" };

export async function loadPendingConsent(tid: string): Promise<PendingConsent> {
  return withPool(async (pool) => {
    // Single SELECT with the freshness predicate in the WHERE so the
    // happy-path is one round-trip.
    const fresh = await pool.query<{
      user_sub: string;
      client_id: string;
      code_challenge: string;
      redirect_uri: string;
      scopes_effective: string;
      state: string;
      response_type: string;
    }>(
      `SELECT user_sub, client_id, code_challenge, redirect_uri,
              scopes_effective, state, response_type
         FROM web_cli_auth_pending_consent
        WHERE id = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()`,
      [tid],
    );
    if ((fresh.rowCount ?? 0) === 1) {
      const row = fresh.rows[0]!;
      return {
        status: "ok",
        userSub: row.user_sub,
        clientId: row.client_id,
        codeChallenge: row.code_challenge,
        redirectUri: row.redirect_uri,
        scopesEffective: row.scopes_effective,
        state: row.state,
        responseType: row.response_type,
      };
    }

    // Re-classify: missing / consumed / expired.
    const followUp = await pool.query<{
      consumed_at: Date | null;
      expires_at: Date;
    }>(
      `SELECT consumed_at, expires_at
         FROM web_cli_auth_pending_consent
        WHERE id = $1`,
      [tid],
    );
    if ((followUp.rowCount ?? 0) === 0) {
      return { status: "missing" };
    }
    const row = followUp.rows[0]!;
    if (row.consumed_at !== null) {
      return { status: "consumed" };
    }
    if (row.expires_at.getTime() <= Date.now()) {
      return { status: "expired" };
    }
    // Same safety net as grant-store: unreachable in normal flow.
    return { status: "missing" };
  });
}

export async function markPendingConsumed(tid: string): Promise<boolean> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `UPDATE web_cli_auth_pending_consent
          SET consumed_at = NOW()
        WHERE id = $1 AND consumed_at IS NULL`,
      [tid],
    );
    return (result.rowCount ?? 0) === 1;
  });
}

// Atomic consume used by POST /cli/consent/submit (plan D6.1 + P1-4 fix).
//
// Replaces the TOCTOU pair of `loadPendingConsent(tid)` followed by
// `markPendingConsumed(tid)`. The atomic variant folds the freshness
// predicate (`consumed_at IS NULL` AND `expires_at > NOW()`) and the
// user-mismatch check (`user_sub = $2`) into the WHERE clause so the
// UPDATE itself decides who wins.
//
//   UPDATE web_cli_auth_pending_consent
//      SET consumed_at = NOW()
//    WHERE id = $1
//      AND user_sub = $2
//      AND consumed_at IS NULL
//      AND expires_at > NOW()
// RETURNING user_sub, client_id, code_challenge, redirect_uri,
//           scopes_effective, state, response_type;
//
// rowCount === 1 ⇒ status "ok" with the row payload.
// rowCount === 0 ⇒ classify via a follow-up SELECT (missing / consumed /
//   expired / user_mismatch). Mirrors the consumeGrantOnce pattern so the
// failure surface is uniform across the two stores.
export type AtomicConsumeResult =
  | {
      status: "ok";
      userSub: string;
      clientId: string;
      codeChallenge: string;
      redirectUri: string;
      scopesEffective: string;
      state: string;
      responseType: string;
    }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "consumed" }
  | { status: "user_mismatch"; storedUserSub: string };

export async function atomicConsumePendingConsent(
  tid: string,
  currentUserSub: string,
): Promise<AtomicConsumeResult> {
  return withPool(async (pool) => {
    const claim = await pool.query<{
      user_sub: string;
      client_id: string;
      code_challenge: string;
      redirect_uri: string;
      scopes_effective: string;
      state: string;
      response_type: string;
    }>(
      `UPDATE web_cli_auth_pending_consent
          SET consumed_at = NOW()
        WHERE id = $1
          AND user_sub = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
        RETURNING user_sub, client_id, code_challenge, redirect_uri,
                  scopes_effective, state, response_type`,
      [tid, currentUserSub],
    );
    if ((claim.rowCount ?? 0) === 1) {
      const row = claim.rows[0]!;
      return {
        status: "ok",
        userSub: row.user_sub,
        clientId: row.client_id,
        codeChallenge: row.code_challenge,
        redirectUri: row.redirect_uri,
        scopesEffective: row.scopes_effective,
        state: row.state,
        responseType: row.response_type,
      };
    }

    // rowCount === 0: classify the loss.
    const followUp = await pool.query<{
      consumed_at: Date | null;
      expires_at: Date;
      user_sub: string;
    }>(
      `SELECT consumed_at, expires_at, user_sub
         FROM web_cli_auth_pending_consent
        WHERE id = $1`,
      [tid],
    );
    if ((followUp.rowCount ?? 0) === 0) {
      return { status: "missing" };
    }
    const row = followUp.rows[0]!;
    if (row.consumed_at !== null) {
      return { status: "consumed" };
    }
    if (row.expires_at.getTime() <= Date.now()) {
      return { status: "expired" };
    }
    // Row is fresh and not consumed; only reason the UPDATE failed is the
    // user_sub mismatch.
    return { status: "user_mismatch", storedUserSub: row.user_sub };
  });
}
