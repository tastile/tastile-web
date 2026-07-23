import { test, expect } from "@playwright/test";
/**
 * AT-070..073 — H group.  These are structural / grep-style tests that
 * verify the v1 design has NO legacy 6-axis enum / rest-nap-carryover
 * structures / v7 JSONB / local-time references in production code or
 * the DB schema.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const CORE = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-core";
const WEB = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web"; 

function psqlAt(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-At", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

test.describe("v1 - Structural invariants (AT-070..073)", () => {
  test("AT-070 6-axis enum does not exist in DB or v1 source", async () => {
    // The 6-axis model (Measure / Trigger / Domain / Transform /
    // Satisfaction / Propagation) is the v0 conceptual model that v1
    // explicitly replaced.  Verify it is not surfaced in the DB enum
    // tables or the v1 source code.
    const enumRows = psqlAt(
      "SELECT count(*) FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname LIKE 'v1_%' OR t.typname LIKE 'v7_%';"
    );
    // The DB schema uses smallint numeric enums (v1/10 \u00a72), not
    // PostgreSQL enum types, so this should be 0.  Belt-and-suspenders.
    expect(Number(enumRows)).toBe(0);

    // Grep the v1 source tree for the legacy axis names.  Allow
    // comments / docs but no symbol references.
    const v1Src = path.join(CORE, "crates", "v1");
    const legacyNames = [
      "SixAxis", "AxisKind", "Axis::",
      "MeasureKind", "TriggerKind", "DomainKind",
      "SatisfactionKind",
      // v1 still uses `transform_kind` (a frame-rule generator
      // discriminator, NOT the v0 6-axis "Transform" axis), so we
      // intentionally do NOT flag it here.
    ];
    const violations: string[] = [];
    function walk(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && p.endsWith(".rs") && !p.endsWith("at_acceptance_tests.rs")) {
          // Strip Rust line/block comments so docs that name the legacy
          // axes (e.g. "see v0 enum Propagation") do not flag.
          const raw = fs.readFileSync(p, "utf8");
          const content = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
          for (const name of legacyNames) {
            if (content.includes(name)) violations.push(p + " :: " + name);
          }
        }
      }
    }
    if (fs.existsSync(v1Src)) walk(v1Src);
    expect(violations).toEqual([]);
  });

  test("AT-071 no dedicated rest / nap / carryover enums or flags", () => {
    const v1Src = path.join(CORE, "crates", "v1");
    const prohibited = [
      "restMode", "napRule", "sleepDebt", "breakMode", "carryover",
      "RestMode", "NapRule", "SleepDebt", "BreakMode", "Carryover",
      "rest_mode", "nap_rule", "sleep_debt", "break_mode",
    ];
    const violations: string[] = [];
    function walk(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && p.endsWith(".rs") && !p.endsWith("at_acceptance_tests.rs")) {
          const raw = fs.readFileSync(p, "utf8");
          const content = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
          for (const name of prohibited) {
            if (content.includes(name)) violations.push(p + " :: " + name);
          }
        }
      }
    }
    if (fs.existsSync(v1Src)) walk(v1Src);
    expect(violations).toEqual([]);
  });

  test("AT-072 no v7-derived JSONB tables / columns", () => {
    // v1/12 AT-072 forbids v7_tiles / v7_intent_nodes / v7_demand_templates
    // / v7_condition_atoms.  Search the live DB for any v7_* tables.
    const v7Tables = psqlAt(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'v7_%';"
    );
    expect(Number(v7Tables)).toBe(0);

    // Also: no JSONB column whose name suggests v7 leftovers.
    const v7JsonbCols = psqlAt(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'jsonb' AND (column_name LIKE 'v7_%' OR column_name LIKE 'intent_%' OR column_name LIKE 'demand_%');"
    );
    expect(Number(v7JsonbCols)).toBe(0);
  });

  test("AT-073 timestamps are stored as timestamptz (UTC); no client-side timezone columns", () => {
    // v1/03 §Time-and-Windows: all moments live in UTC plus a small
    // offset_min (smallint, minutes) reference.  Two structural
    // constraints are enforceable here: (a) no timestamp without time
    // zone columns in v1_*, and (b) no client-side timezone strings
    // (e.g. client_tz, device_tz, local_time).  The "offset_*"
    // columns that exist in v1 are part of the spec and are not the
    // local-time reference AT-073 forbids.
    const localTzCols = psqlAt(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE 'v1_%' AND (data_type = 'timestamp without time zone' OR column_name IN ('client_tz', 'device_tz', 'local_time'));"
    );
    expect(Number(localTzCols)).toBe(0);
  });

});
