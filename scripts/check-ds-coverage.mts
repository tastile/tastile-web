#!/usr/bin/env bun
/**
 * DS v2 token discipline static checker.
 *
 * Scans all tsx in src/widgets, src/features, src/views, src/app for
 * forbidden patterns introduced by P2 ESLint rules. This is the runtime
 * fallback for editors that don't run ESLint, and the CI gate that runs
 * even if ESLint is disabled.
 *
 * Forbidden patterns:
 *   - Mantine `shadow="..."` / `shadow={...}` props (jsx className-like)
 *   - Mantine `withBorder` / `withBorder={true}` props
 *   - Tailwind `border-*` (whitelist: border-0, border-collapse, border-spacing, border-transparent, border-border[, border-border/NN])
 *   - Tailwind `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-inner`, `shadow-none`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src/widgets', 'src/features', 'src/views', 'src/app'];
const EXTS = ['.tsx'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'src/lib/vendored']);

// Ruling 9-corrected: whitelist `border-border` / `border-border/NN` in
// addition to border-0 / collapse / spacing / transparent (those are the
// built-in Tailwind utilities).
const BORDER_REGEX = /\bborder-(?!0\b|collapse\b|spacing\b|transparent\b|border(?:\b|\/))[a-z0-9./-]+/g;
const SHADOW_REGEX = /\bshadow-(?:sm|md|lg|xl|inner|none)\b/g;
const MANTINE_SHADOW = /\bshadow=(?:"|\{)/g;
const MANTINE_WITHBORDER = /\bwithBorder(?:=\{true\}|>|\s)/g;

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  rule: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (EXTS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function findViolations(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf8');
  const violations: Violation[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const match of line.matchAll(BORDER_REGEX)) {
      violations.push({ file: filePath, line: i + 1, column: match.index! + 1, match: match[0], rule: 'no-border-class' });
    }
    for (const match of line.matchAll(SHADOW_REGEX)) {
      violations.push({ file: filePath, line: i + 1, column: match.index! + 1, match: match[0], rule: 'no-shadow-class' });
    }
    for (const match of line.matchAll(MANTINE_SHADOW)) {
      violations.push({ file: filePath, line: i + 1, column: match.index! + 1, match: match[0], rule: 'no-mantine-shadow-prop' });
    }
    for (const match of line.matchAll(MANTINE_WITHBORDER)) {
      violations.push({ file: filePath, line: i + 1, column: match.index! + 1, match: match[0], rule: 'no-mantine-withborder-prop' });
    }
  }
  return violations;
}

const allViolations: Violation[] = [];
for (const scanDir of SCAN_DIRS) {
  const fullDir = join(ROOT, scanDir);
  try {
    statSync(fullDir);
  } catch {
    continue;
  }
  const files = walk(fullDir);
  for (const f of files) allViolations.push(...findViolations(f));
}

if (allViolations.length === 0) {
  console.log(`OK: 0 DS v2 token violations across ${SCAN_DIRS.join(', ')}`);
  process.exit(0);
}

console.error(`FAIL: ${allViolations.length} DS v2 token violations found`);
for (const v of allViolations.slice(0, 50)) {
  console.error(`  ${relative(ROOT, v.file)}:${v.line}:${v.column}  ${v.rule}  ${v.match}`);
}
if (allViolations.length > 50) console.error(`  ... and ${allViolations.length - 50} more`);
process.exit(1);
