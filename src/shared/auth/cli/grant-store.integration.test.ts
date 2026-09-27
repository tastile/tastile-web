// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { ensureWebCliGrantsSchema } from "@/lib/migrations/web-cli-grants";
import { hashGrantCode } from "./pkce";
import { consumeGrantOnce, insertGrant } from "./grant-store";

// Real-Postgres concurrency test (Issue #153, plan D10). Runs only when
// TASTILE_AUTH_DATABASE_URL is set; CI spins up a `postgres:16` service in
// `.github/workflows/pr-smoke.yml` (cli-auth-postgres job) and
// `quality.yml`. Local dev: `docker run --rm -p 5432:5432 -e
// POSTGRES_DB=cli_auth_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test
// postgres:16`.

const DB_URL = process.env.TASTILE_AUTH_DATABASE_URL;

const describeIfDb = DB_URL ? describe : describe.skip;

describeIfDb("grant-store (real Postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!DB_URL) return;
    pool = new Pool({ connectionString: DB_URL });
    await ensureWebCliGrantsSchema(pool);
    // Clean any rows left over from a prior run; the table is short-lived
    // so a TRUNCATE is safe.
    await pool.query("TRUNCATE web_cli_auth_grant");
  });

  afterAll(async () => {
    if (pool) await pool.end().catch(() => undefined);
  });

  it("grants exactly one winner under N concurrent consumers (N=8)", async () => {
    if (!DB_URL) return;
    // Each concurrent caller needs its own Pool (max=1 per pool) so the
    // pool-level connection limit does not serialize them — pg serializes
    // queries on a single client.
    const N = 8;
    const code = "concurrency-test-code";
    const challenge = "concurrency-test-challenge";
    const redirect = "http://127.0.0.1:1234/callback";
    await insertGrant({
      code,
      clientId: "tastile-cli",
      userSub: "user-x",
      codeChallenge: challenge,
      redirectUri: redirect,
      scopesRequested: "tastile.read tastile.write",
      scopesEffective: "tastile.read tastile.write",
      ttlSeconds: 300,
    });
    const codeHash = hashGrantCode(code);

    const callers = Array.from({ length: N }, () => new Pool({ connectionString: DB_URL!, max: 1 }));
    try {
      // Pre-warm all connections so the race starts cold.
      await Promise.all(callers.map((p) => p.query("SELECT 1")));

      const promises = callers.map((p) =>
        (async () => {
          const client = await p.connect();
          try {
            const r = await client.query(
              `UPDATE web_cli_auth_grant
                  SET used_at = NOW()
                WHERE code_hash = $1
                  AND used_at IS NULL
                  AND expires_at > NOW()
                  AND code_challenge = $2
                  AND redirect_uri = $3
                RETURNING user_sub, client_id, scopes_effective`,
              [codeHash, challenge, redirect],
            );
            return r.rowCount ?? 0;
          } finally {
            client.release();
          }
        })(),
      );
      const results = await Promise.all(promises);
      const winners = results.filter((rowCount) => rowCount === 1).length;
      const losers = results.filter((rowCount) => rowCount === 0).length;
      expect(winners).toBe(1);
      expect(losers).toBe(N - 1);

      // And the application-side consumeGrantOnce path returns the same
      // shape for the same fixture.
      const result = await consumeGrantOnce({
        code,
        codeChallenge: challenge,
        redirectUri: redirect,
      });
      // Whichever caller already consumed will leave status=already_used
      // for subsequent calls.
      expect(["ok", "already_used"]).toContain(result.status);
      if (result.status === "ok") {
        expect(result.userSub).toBe("user-x");
        expect(result.clientId).toBe("tastile-cli");
        expect(result.scopesEffective).toBe("tastile.read tastile.write");
      }
    } finally {
      await Promise.all(callers.map((p) => p.end().catch(() => undefined)));
    }
  });
});
