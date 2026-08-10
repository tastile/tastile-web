// e2e/helpers/psql.ts — DB ground-truth helpers for e2e specs.
//
// Contract: every helper here shells out to `wslc container exec …` so
// the test reads the live v1 Postgres instance via psql.  No helper
// makes an HTTP request to /api/proxy/v1/* — that would short-circuit
// the UI contract that this repo's E2E suite enforces.
//
// `psqlQuery` tries the `tastile-db` container first (canonical from
// scripts/wslc/up-v1.sh) and falls back to `tastile-dev-api` (the dev
// image runs an embedded postgres on /var/run/postgresql).  On this
// Windows host the dev image is the one kept warm across sessions
// (memory `feedback_wslc_daemon_wedge.md` documents why the daemon
// wedges), so the fallback is the common path.
//
// Retries on transient psql errors up to 3 times with 250 ms backoff.
// Returns rows as plain objects keyed by column index (`c0`, `c1`, …)
// because psql's tab-separated output has no header row in `-tA` mode.

import { execFileSync } from "node:child_process";

// SOH (0x01) — an unprintable ASCII byte that psql will never emit in
// a result row.  Using a real character instead of a string escape
// keeps the heredoc / linter round-trip safe and lets us split rows /
// columns on the same separator everywhere.
const FS = String.fromCharCode(1);

export async function psqlQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const targets: ReadonlyArray<readonly [string, ...string[]]> = [
    ["tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-tA", "-F", FS, "-c", sql],
    [
      "tastile-dev-api",
      "su",
      "-c",
      `psql -U tastile -d tastile -tA -F $'\\x01' -c "${sql.replace(/"/g, '\\"')}"`,
      "postgres",
    ],
  ];
  let lastErr: unknown = null;
  for (const cmd of targets) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const out = execFileSync("wslc", ["container", "exec", ...cmd], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30_000,
        });
        const lines = out.split("\n").filter((line) => line.length > 0);
        return lines.map((line) => {
          const cols = line.includes(FS) ? line.split(FS) : [line];
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) obj[`c${i}`] = cols[i];
          return obj as T;
        });
      } catch (err) {
        lastErr = err;
        if (attempt === 3) break;
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
  }
  throw lastErr;
}

/** SELECT count(*) FROM <table> WHERE <whereClause>.  Returns 0 when no
 *  row matches (including when psql returns an empty result set). */
export async function psqlCount(table: string, whereClause: string): Promise<number> {
  const sql = `SELECT count(*) FROM ${table} WHERE ${whereClause};`;
  const rows = await psqlQuery<{ c0: string }>(sql);
  if (rows.length === 0) return 0;
  return Number(rows[0].c0);
}
