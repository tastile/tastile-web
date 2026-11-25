import { Pool, type PoolClient } from "pg";

import type { MailQuotaStore, MailQuotaWindow } from "./quota";

// Postgres-backed mail quota store (Issue #262). Follows the lazy-bootstrap
// pattern of src/lib/migrations/web-cli-grants.ts: the schema is ensured on
// first use inside one transaction, and the pool is created lazily so
// `next build` without TASTILE_AUTH_DATABASE_URL does not crash.
//
// The table lives in the auth database next to the CLI-grant tables. The
// BetterAuth role already has CREATE on the current schema (same assumption
// as web-cli-grants); if a deploy rejects CREATE, move the DDL to a
// deploy-time migration — CREATE TABLE IF NOT EXISTS stays safe either way.
//
// Window rows are keyed by bucket ("hour:YYYY-MM-DDTHH", "day:YYYY-MM-DD")
// and accumulate ~48 rows/day. That is intentionally tiny; no cleanup job is
// required for the free-tier horizon.

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS tastile_mail_quota (
  window_key  TEXT PRIMARY KEY,
  sent        INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const CONSUME_SQL = `
INSERT INTO tastile_mail_quota (window_key, sent)
VALUES ($1, 1)
ON CONFLICT (window_key)
DO UPDATE SET sent = tastile_mail_quota.sent + 1, updated_at = NOW()
RETURNING sent`;

export class PgMailQuotaStore implements MailQuotaStore {
	private schemaReady: Promise<void> | null = null;

	constructor(private readonly pool: Pool) {}

	private ensureSchema(): Promise<void> {
		if (!this.schemaReady) {
			this.schemaReady = this.pool.query(SCHEMA_DDL).then(() => undefined);
		}
		return this.schemaReady;
	}

	async tryConsume(windows: readonly MailQuotaWindow[]): Promise<boolean> {
		await this.ensureSchema();
		const client: PoolClient = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const window of windows) {
				const result = await client.query(CONSUME_SQL, [window.key]);
				const sent = result.rows[0]?.sent ?? 0;
				if (sent > window.limit) {
					await client.query("ROLLBACK");
					return false;
				}
			}
			await client.query("COMMIT");
			return true;
		} catch (err) {
			await client.query("ROLLBACK").catch(() => undefined);
			throw err;
		} finally {
			client.release();
		}
	}
}

/** Test helper: in-memory quota store with the same consume semantics. */
export class InMemoryMailQuotaStore implements MailQuotaStore {
	private readonly counts = new Map<string, number>();

	async tryConsume(windows: readonly MailQuotaWindow[]): Promise<boolean> {
		for (const window of windows) {
			const next = (this.counts.get(window.key) ?? 0) + 1;
			if (next > window.limit) return false;
		}
		for (const window of windows) {
			this.counts.set(window.key, (this.counts.get(window.key) ?? 0) + 1);
		}
		return true;
	}

	/** Test inspection helper. */
	countFor(key: string): number {
		return this.counts.get(key) ?? 0;
	}
}

