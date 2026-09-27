// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { ensureWebCliGrantsSchema } from "@/lib/migrations/web-cli-grants";
import { s256 } from "./pkce";
import { consumeGrantOnce, insertGrant } from "./grant-store";

// Real-Postgres concurrency test (Issue #153, plan D10 + P1-5 fix).
// Runs only when TASTILE_AUTH_DATABASE_URL is set; CI spins up a
// `postgres:16` service in `.github/workflows/pr-smoke.yml`
// (cli-auth-postgres job) and `quality.yml`. Local dev: `docker run --rm
// -p 5432:5432 -e POSTGRES_DB=cli_auth_test -e POSTGRES_USER=test -e
// POSTGRES_PASSWORD=test postgres:16`.
//
// This test calls `consumeGrantOnce()` directly (not a hand-written SQL
// replica) so a regression in the production claim statement is caught.
// The previous version re-implemented the UPDATE in the test file and
// could not detect a drift between the test's SQL and the production
// function's SQL.

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

  it("consumeGrantOnce: exactly one of N concurrent callers wins (N=8)", async () => {
    if (!DB_URL) return;

    // Pre-compute the S256(verifier) challenge so the production
    // consumeGrantOnce sees the exact value the wire contract produces.
    const N = 8;
    const code = "concurrency-test-code";
    const verifier = "concurrency-test-verifier";
    const codeChallenge = s256(verifier);
    const redirect = "http://127.0.0.1:1234/callback";

    await insertGrant({
      code,
      clientId: "tastile-cli",
      userSub: "user-x",
      codeChallenge,
      redirectUri: redirect,
      scopesRequested: "tastile.read tastile.write",
      scopesEffective: "tastile.read tastile.write",
      ttlSeconds: 300,
    });

    // Each concurrent caller needs its own Pool (max=1 per pool) so the
    // pool-level connection limit does not serialize them — pg serializes
    // queries on a single client.
    const callers = Array.from(
      { length: N },
      () => new Pool({ connectionString: DB_URL!, max: 1 }),
    );
    try {
      // Pre-warm all connections so the race starts cold.
      await Promise.all(callers.map((p) => p.query("SELECT 1")));

      const promises = callers.map((p) =>
        (async () => {
          // Open a dedicated client so consumeGrantOnce's
          // `pool.connect()` round-trip is already paid for.
          const client = await p.connect();
          try {
            return await consumeGrantOnce({
              code,
              codeChallenge,
              redirectUri: redirect,
            });
          } finally {
            client.release(true);
          }
        })(),
      );

      const results = await Promise.all(promises);
      const winners = results.filter((r) => r.status === "ok");
      const losers = results.filter((r) => r.status === "already_used");

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(N - 1);

      // The single winner must carry the row payload the production
      // claim statement returns.
      const w = winners[0]!;
      expect(w).toMatchObject({
        status: "ok",
        userSub: "user-x",
        clientId: "tastile-cli",
        scopesEffective: "tastile.read tastile.write",
      });
    } finally {
      await Promise.all(callers.map((p) => p.end().catch(() => undefined)));
    }
  });
});