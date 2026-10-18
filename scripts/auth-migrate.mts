// Apply the BetterAuth schema to the auth database (TASTILE_AUTH_DATABASE_URL) using the same
// options the server runs with. Idempotent: only missing tables/columns are created, and
// unsafe changes (a required column without default on a populated table) are refused.
//
// Usage: bun scripts/auth-migrate.mts [--dry-run]
// Run it with the target environment's injected values, e.g. through Infisical.
import { getMigrations } from "better-auth/db/migration";

import { getAuth } from "../src/shared/auth/better-auth/server";

const dryRun = process.argv.includes("--dry-run");
const auth = await getAuth();
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
const plan = {
  create: toBeCreated.map((t) => t.table),
  add: toBeAdded.map((t) => ({ table: t.table, fields: Object.keys(t.fields) })),
};
console.log(JSON.stringify({ dryRun, plan }));
if (!dryRun && (plan.create.length > 0 || plan.add.length > 0)) {
  await runMigrations();
  const after = await getMigrations(auth.options);
  if (after.toBeCreated.length > 0 || after.toBeAdded.length > 0) {
    throw new Error("BetterAuth schema still incomplete after migration");
  }
  console.log(JSON.stringify({ migrated: true }));
}
process.exit(0);
