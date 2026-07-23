import { describe, expect, it, afterAll } from "vitest";
import { ESLint } from "eslint";
import fs from "node:fs";
import os from "node:os";
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

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: configPath,
});

async function lintFile(filePath: string): Promise<LintOutcome[]> {
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
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message).toMatch(/next\/headers/);
  });

  it("forbids v1 domain code from importing React components", async () => {
    const file = writeProbe(
      "src/lib/domain/v1/__probe__.ts",
      `import { TastileLogo } from "@/components/TastileLogo";\nexport const x = TastileLogo;\n`,
    );
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /@\/components\/TastileLogo/.test(h.message))).toBe(true);
  });

  it("forbids lib code from importing @/features", async () => {
    const file = writeProbe(
      "src/lib/__probe__.ts",
      `import { ProfilePanel } from "@/features/profile/ProfilePanel";\nexport const x = ProfilePanel;\n`,
    );
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /@\/features/.test(h.message))).toBe(true);
  });

  it("forbids client hooks from importing upstream events module", async () => {
    const file = writeProbe(
      "src/lib/hooks/use-__probe__.ts",
      `import { something } from "@/lib/upstream/events";\nexport const x = something;\n`,
    );
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /upstream\/events/.test(h.message))).toBe(true);
  });

  it("allows route handlers to import next/server", async () => {
    const file = writeProbe(
      "src/app/api/__probe__/route.ts",
      `import { NextResponse } from "next/server";\nexport const GET = () => NextResponse.json({ ok: true });\n`,
    );
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(0);
  });

  it("allows the test file itself to import restricted modules", async () => {
    const file = writeProbe(
      "src/components/__probe__.test.ts",
      `import { cookies } from "next/headers";\nexport const x = cookies;\n`,
    );
    const messages = await lintFile(file);
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    expect(hits).toHaveLength(0);
  });
});
