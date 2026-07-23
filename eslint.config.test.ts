import { describe, expect, it, afterAll, beforeEach } from "vitest";
import { ESLint } from "eslint";
import { clearCaches } from "@typescript-eslint/typescript-estree";
import fs from "node:fs";
import path from "node:path";

const repoRoot = __dirname;
const configPath = path.join(repoRoot, "eslint.config.mjs");

type LintOutcome = {
  ruleId: string | null;
  message: string;
};

const probes: Array<{ filePath: string; cleanup: () => void }> = [];

function writeProbe(relPath: string, code: string): string {
  const abs = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, code, "utf8");
  probes.push({ filePath: abs, cleanup: () => fs.rmSync(abs, { force: true }) });
  return abs;
}

afterAll(() => {
  for (const p of probes) p.cleanup();
});

// The TS-ESLint parser caches a single Program per process (per
// tsconfig path) in a module-level Map. When this test file is loaded
// alongside other test files in the same vitest worker, the cached
// Program was already initialized against a different set of on-disk
// files. Writing a probe file with fs.writeFileSync and then calling
// lintFiles on a *fresh* ESLint instance still reuses that cached
// Program, which can miss the probe (CI's ubuntu-latest runner shows
// 4–17 ms follow-up timings vs the 6 s program init, the signature of
// "parser returned no source file, no rules fired"). clearCaches()
// drops the cached Program so the next new ESLint() builds a fresh
// one that scans the current on-disk state. The typescript-estree
// package documents this exact use case in clearCaches()'s JSDoc:
// "In tests to reset parser state to keep tests isolated." We call
// it before each test because the Program is re-cached after each
// fresh new ESLint() and we want the next test's probe to be visible.
beforeEach(() => {
  clearCaches();
});

function makeEslint(): ESLint {
  return new ESLint({ cwd: repoRoot, overrideConfigFile: configPath });
}

async function lintFile(
  eslint: ESLint,
  filePath: string,
): Promise<LintOutcome[]> {
  const [result] = await eslint.lintFiles([filePath]);
  return result.messages.map((m) => ({
    ruleId: m.ruleId,
    message: m.message,
  }));
}

describe("eslint.config.mjs boundary rules", { timeout: 120_000 }, () => {
  it("forbids client components from importing next/headers", async () => {
    const file = writeProbe(
      "src/components/__probe__.tsx",
      `import { cookies } from "next/headers";\nexport const x = cookies;\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message).toMatch(/next\/headers/);
  });

  it("forbids v1 domain code from importing React components", async () => {
    const file = writeProbe(
      "src/lib/domain/v1/__probe__.ts",
      `import { TastileLogo } from "@/components/TastileLogo";\nexport const x = TastileLogo;\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /@\/components\/TastileLogo/.test(h.message))).toBe(true);
  });

  it("forbids lib code from importing @/features", async () => {
    const file = writeProbe(
      "src/lib/__probe__.ts",
      `import { ProfilePanel } from "@/features/profile/ProfilePanel";\nexport const x = ProfilePanel;\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /@\/features/.test(h.message))).toBe(true);
  });

  it("forbids client hooks from importing upstream events module", async () => {
    const file = writeProbe(
      "src/lib/hooks/use-__probe__.ts",
      `import { something } from "@/lib/upstream/events";\nexport const x = something;\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /upstream\/events/.test(h.message))).toBe(true);
  });

  it("allows route handlers to import next/server", async () => {
    const file = writeProbe(
      "src/app/api/__probe__/route.ts",
      `import { NextResponse } from "next/server";\nexport const GET = () => NextResponse.json({ ok: true });\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(0);
  });

  it("allows the test file itself to import restricted modules", async () => {
    const file = writeProbe(
      "src/components/__probe__.test.ts",
      `import { cookies } from "next/headers";\nexport const x = cookies;\n`,
    );
    const messages = await lintFile(makeEslint(), file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(0);
  });
});
