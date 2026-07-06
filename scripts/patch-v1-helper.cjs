/* eslint-disable @typescript-eslint/no-require-imports */
// Extend v1CreatePlacement to accept tags[] and seed v1_annotation rows
const fs = require('node:fs');
const path = 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\e2e\\helpers\\v1.ts';
const before = fs.readFileSync(path, 'utf8');
const eol = before.includes('\r\n') ? '\r\n' : '\n';
const nl = eol;

const oldInput = ['export interface V1CreatePlacementInput {',
  '  title: string;',
  '  start: string;',
  '  end: string;',
  '  color?: string;',
  '  icon?: string;',
  '}'].join(nl);
if (!before.includes(oldInput)) {
  console.error('V1CreatePlacementInput block not found verbatim');
  process.exit(1);
}
const newInput = ['export interface V1CreatePlacementInput {',
  '  title: string;',
  '  start: string;',
  '  end: string;',
  '  color?: string;',
  '  icon?: string;',
  '  /** Optional labels to seed as v1_annotation rows (kind=0 / TIME_WINDOW) */',
  '  labels?: string[];',
  '}'].join(nl);
const after1 = before.replace(oldInput, newInput);

const oldTruncate = '"TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;"';
const newTruncate = '"TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation RESTART IDENTITY CASCADE;"';
const after2 = after1.replace(oldTruncate, newTruncate);

const marker = ['  return { tileId, planId, placementId };',
  '}',
  '',
  '/**',
  ' * Convenience wrapper: create a placement then resolve its'].join(nl);
if (!after2.includes(marker)) {
  console.error('v1CreatePlacement tail marker not found');
  process.exit(1);
}

const id = "' + 'X' + '"; // eslint-disable-line @typescript-eslint/no-unused-vars
// Build the SQL using a string concat so we never have to escape backticks/single-quotes
// inside a single-quoted TS source file written via PowerShell.
const replacementParts = [
  '  // 4) Optional: seed v1_annotation rows for tag-suggest tests.',
  '  //    v1 has no public write API for v1_annotation in Phase A,',
  '  //    so we insert directly via docker exec.  kind=0 (TIME_WINDOW).',
  '  if (input.labels && input.labels.length > 0) {',
  '    const { execFileSync } = await import("node:child_process");',
  '    for (const label of input.labels) {',
  '      if (!label) continue;',
  '      const escaped = label.replace(/' + "'" + '/g, "' + "'" + "'" + "'" + ');',
  '      const annId = crypto.randomUUID();',
  '      const sql = "INSERT INTO v1_annotation (id, tile_id, kind, label, owner_id, revision, created_at, updated_at) VALUES (' + "'" + '" + annId + "' + "'" + '::uuid, ' + "'" + '" + tileId + "' + "'" + '::uuid, 0, ' + "'" + '" + escaped + "' + "'" + ', ' + "'" + '00000000-0000-0000-0000-000000000001' + "'" + '::uuid, 1, now(), now()) ON CONFLICT (id) DO NOTHING;";',
  '      try {',
  '        execFileSync("docker", ["exec", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql], { stdio: "ignore" });',
  '      } catch (e) {',
  '        // best-effort: tag-suggest popovers are non-critical',
  '      }',
  '    }',
  '  }',
  '',
  '  return { tileId, planId, placementId };',
  '}',
  '',
  '/**',
  ' * Convenience wrapper: create a placement then resolve its',
];
const replacement = replacementParts.join(nl);
const after3 = after2.replace(marker, replacement);
fs.writeFileSync(path, after3);
console.log('v1 helper extended');
