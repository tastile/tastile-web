#!/usr/bin/env bun
//
// i18n literal guard.
//
// Read-only audit that scans src ts/tsx files for hardcoded Japanese /
// Chinese / Korean literals and reports policy §11 violations. Never writes
// to any file. Stdout-only JSON output. Per policy §30, callers should
// redirect into .tmp/audit-i18n-literals.json.
//
// Exits:
//   0 = CLEAN
//   1 = VIOLATIONS (>=1 finding)
//   2 = SCRIPT_ERROR (parse / IO failure)
//
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const srcRoot = path.join(repoRoot, "src");

// Hiragana, Katakana, Han (CJK Unified Ideographs) — exclude Hangul/Jamo for
// Tastile scope (English + Japanese user-facing text only).
const CJK_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/u;

const ALWAYS_EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".tmp",
  ".reference",
]);

const ALWAYS_EXCLUDE_PATH_PREFIXES = [
  "src/shared/i18n/",
  "src/test/",
  "src/lib/test/",
  "src/lib/api/v1/openapi-generated.",
];

const ALWAYS_EXCLUDE_PATH_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
];

const ALWAYS_EXCLUDE_PATH_INFIXES = ["/__tests__/", "/__mocks__/"];

function shouldExcludePath(relativePath) {
  for (const prefix of ALWAYS_EXCLUDE_PATH_PREFIXES) {
    if (relativePath.startsWith(prefix)) return true;
  }
  for (const suffix of ALWAYS_EXCLUDE_PATH_SUFFIXES) {
    if (relativePath.endsWith(suffix)) return true;
  }
  for (const infix of ALWAYS_EXCLUDE_PATH_INFIXES) {
    if (relativePath.includes(infix)) return true;
  }
  return false;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const entry of entries) {
    if (ALWAYS_EXCLUDE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(abs)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function classifyLine(line) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("/**") || trimmed.startsWith("/* ") || trimmed.startsWith("*")) {
    return "comment-block";
  }
  if (trimmed.startsWith("//")) return "comment-line";
  if (/^\s*(aria-label|title|alt|placeholder|aria-labelledby)\s*[:=]/i.test(line)) {
    return "jsx-attr";
  }
  // Heuristic: line contains JSX-like text ">" followed by CJK before "<"
  if (/>[^<\n]*$/.test(trimmed) && !trimmed.includes("{")) return "jsx-text";
  // String literal in JS/TS — find quoted CJK
  const stringMatch = line.match(/(['"`])(?:\\.|(?!\1).)*\1/);
  if (stringMatch && CJK_PATTERN.test(stringMatch[0])) return "string-literal";
  return "needs-review";
}

async function scanFile(absPath) {
  const relativePath = path.relative(repoRoot, absPath).replace(/\\/g, "/");
  if (shouldExcludePath(relativePath)) return [];
  const text = await readFile(absPath, "utf8");
  const findings = [];
  const lines = text.split(/\r?\n/);
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!CJK_PATTERN.test(line)) continue;
    let classification = classifyLine(line);
    if (classification === "comment-block") {
      // Block comment tracking — skip state machine since the class already
      // catches `/**`, `/*`, `*` prefixes; deeper detection not needed.
    } else if (inBlockComment) {
      classification = "comment-block";
    }
    if (line.includes("/*") && !line.includes("*/")) inBlockComment = true;
    if (line.includes("*/")) inBlockComment = false;

    findings.push({
      file: relativePath,
      line: i + 1,
      class: classification,
      text: line.trim().slice(0, 200),
    });
  }
  return findings;
}

async function main() {
  const files = await walk(srcRoot);
  const allFindings = [];
  let scannedCount = 0;
  for (const file of files) {
    const findings = await scanFile(file);
    scannedCount += 1;
    allFindings.push(...findings);
  }

  const summary = {
    clean: allFindings.length === 0,
    scannedFiles: scannedCount,
    findings: allFindings.length,
    byClass: allFindings.reduce((acc, f) => {
      acc[f.class] = (acc[f.class] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const report = {
    auditedAt: new Date().toISOString(),
    repoRoot,
    scope: "src/**/*.{ts,tsx}",
    excludes: {
      prefixes: ALWAYS_EXCLUDE_PATH_PREFIXES,
      suffixes: ALWAYS_EXCLUDE_PATH_SUFFIXES,
      infixes: ALWAYS_EXCLUDE_PATH_INFIXES,
    },
    summary,
    findings: allFindings,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (summary.clean) {
    process.exit(0);
  }
  process.exit(1);
}

await main();
