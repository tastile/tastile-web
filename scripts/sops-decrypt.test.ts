// Local fork of tastile-root/scripts/sops-decrypt.test.ts with AWS-specific
// expectations replaced by age-recipient assertions. See sops-decrypt.ts for
// the rationale.
import { beforeEach, describe, expect, it } from "vitest";
import {
  parseArgs,
  loadConfig,
  decryptOne,
  processSourceFiles,
  assertSopsInstalled,
} from "./sops-decrypt";
import type { SopsEnvConfig } from "./sops.config";
import { chmodSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";

describe("parseArgs", () => {
  it("parses --env=development", () => {
    expect(parseArgs(["--env=development"])).toEqual({ env: "development", check: false });
  });
  it("falls back to TASTILE_ENV", () => {
    process.env.TASTILE_ENV = "staging";
    expect(parseArgs([])).toEqual({ env: "staging", check: false });
    delete process.env.TASTILE_ENV;
  });
  it("rejects unknown env", () => {
    expect(() => parseArgs(["--env=bogus"])).toThrow();
  });
  it("emits check flag", () => {
    expect(parseArgs(["--env=production", "--check"]).check).toBe(true);
  });
});

describe("loadConfig", () => {
  it("returns entry for known env", () => {
    const cfg = loadConfig("development");
    expect(cfg.ageRecipient).toMatch(/^age1[0-9a-z]+$/);
    expect(cfg.pairs.length).toBeGreaterThan(0);
  });
  it("throws for unknown env", () => {
    expect(() => loadConfig("nope" as never)).toThrow();
  });
});

describe("assertSopsInstalled", () => {
  it("accepts the configured SOPS_COMMAND when --version succeeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sops-version-test-"));
    const configuredCommand = join(
      dir,
      process.platform === "win32" ? "custom-sops.bat" : "custom-sops",
    );
    const pathCommand = join(dir, process.platform === "win32" ? "sops.bat" : "sops");
    writeFileSync(
      configuredCommand,
      process.platform === "win32"
        ? "@echo off\r\necho SOPS v3.9.0\r\nexit /b 0\r\n"
        : "#!/bin/sh\necho 'SOPS v3.9.0'\nexit 0\n",
    );
    writeFileSync(
      pathCommand,
      process.platform === "win32" ? "@echo off\r\nexit /b 13\r\n" : "#!/bin/sh\nexit 13\n",
    );
    if (process.platform !== "win32") {
      chmodSync(configuredCommand, 0o755);
      chmodSync(pathCommand, 0o755);
    }

    const originalPath = process.env.PATH;
    const originalCommand = process.env.SOPS_COMMAND;
    process.env.PATH = `${dir}${delimiter}${originalPath ?? ""}`;
    process.env.SOPS_COMMAND = configuredCommand;
    try {
      await expect(assertSopsInstalled()).resolves.toBeUndefined();
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalCommand === undefined) delete process.env.SOPS_COMMAND;
      else process.env.SOPS_COMMAND = originalCommand;
    }
  });

  it("probes the configured SOPS_COMMAND", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sops-probe-test-"));
    const configuredCommand = join(
      dir,
      process.platform === "win32" ? "custom-sops.bat" : "custom-sops",
    );
    const pathCommand = join(
      dir,
      process.platform === "win32" ? "sops.bat" : "sops",
    );
    const commandBody =
      process.platform === "win32" ? "@echo off\r\nexit /b 13\r\n" : "#!/bin/sh\nexit 13\n";
    const pathBody =
      process.platform === "win32" ? "@echo off\r\nexit /b 0\r\n" : "#!/bin/sh\nexit 0\n";
    writeFileSync(configuredCommand, commandBody);
    writeFileSync(pathCommand, pathBody);
    if (process.platform !== "win32") {
      chmodSync(configuredCommand, 0o755);
      chmodSync(pathCommand, 0o755);
    }

    const originalPath = process.env.PATH;
    const originalCommand = process.env.SOPS_COMMAND;
    process.env.PATH = `${dir}${delimiter}${originalPath ?? ""}`;
    process.env.SOPS_COMMAND = configuredCommand;
    try {
      await expect(assertSopsInstalled()).rejects.toThrow(/exited 13/);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalCommand === undefined) delete process.env.SOPS_COMMAND;
      else process.env.SOPS_COMMAND = originalCommand;
    }
  });
});

describe("decryptOne", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sops-test-")); });
  it("writes 0600 plain file when sops returns plaintext", async () => {
    const src = join(dir, "fake.sops");
    const dst = join(dir, "fake.env");
    writeFileSync(src, "stub");
    // Stub sops to echo plain
    const stub = `#!/usr/bin/env bash\necho "KEY=value"`;
    writeFileSync(join(dir, "sops"), stub);
    chmodSync(join(dir, "sops"), 0o755);
    // Windows-compatible shim (no-extension shebangs aren't honored)
    writeFileSync(join(dir, "sops.bat"), `@echo off\necho KEY=value`);
    const PATH_BACKUP = process.env.PATH;
    const SOPS_COMMAND_BACKUP = process.env.SOPS_COMMAND;
    process.env.PATH = `${dir}${delimiter}${PATH_BACKUP}`;
    process.env.SOPS_COMMAND = join(
      dir,
      process.platform === "win32" ? "sops.bat" : "sops",
    );
    const cfg = loadConfig("development");
    try {
      const result = await decryptOne(src, dst, cfg, false, "development");
      expect(existsSync(dst)).toBe(true);
      // Unix file modes aren't honored on Windows (ACL-based); check owner r/w bit
      expect((statSync(dst).mode & 0o600)).toBe(0o600);
      expect(readFileSync(dst, "utf8")).toContain("KEY=value");
      expect(result.size).toBeGreaterThan(0);
      expect(result.age_recipient).toBe(cfg.ageRecipient);
      expect(result.env).toBe("development");
    } finally {
      process.env.PATH = PATH_BACKUP;
      if (SOPS_COMMAND_BACKUP === undefined) delete process.env.SOPS_COMMAND;
      else process.env.SOPS_COMMAND = SOPS_COMMAND_BACKUP;
    }
  });
  it("rejects when sops exits non-zero", async () => {
    const src = join(dir, "bad.sops");
    const dst = join(dir, "bad.env");
    writeFileSync(src, "stub");
    const stub = `#!/usr/bin/env bash\necho "boom" 1>&2\nexit 4`;
    writeFileSync(join(dir, "sops"), stub);
    chmodSync(join(dir, "sops"), 0o755);
    // Windows-compatible shim: echo to stderr and exit 4
    writeFileSync(join(dir, "sops.bat"), `@echo off\necho boom 1>&2\nexit /b 4`);
    const PATH_BACKUP = process.env.PATH;
    const SOPS_COMMAND_BACKUP = process.env.SOPS_COMMAND;
    process.env.PATH = `${dir}${delimiter}${PATH_BACKUP}`;
    process.env.SOPS_COMMAND = join(
      dir,
      process.platform === "win32" ? "sops.bat" : "sops",
    );
    const cfg = loadConfig("development");
    try {
      await expect(decryptOne(src, dst, cfg, false, "development")).rejects.toThrow();
    } finally {
      process.env.PATH = PATH_BACKUP;
      if (SOPS_COMMAND_BACKUP === undefined) delete process.env.SOPS_COMMAND;
      else process.env.SOPS_COMMAND = SOPS_COMMAND_BACKUP;
    }
  });
});

describe("processSourceFiles", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sops-test-")); });
  it("decryptOne_missing_source_emits_warning_and_continues", async () => {
    const cfg = loadConfig("development");
    const stub: SopsEnvConfig = {
      ...cfg,
      pairs: [{ source: join(dir, "definitely-missing.sops"), target: join(dir, "definitely-missing.env") }],
    };
    const stderrChunks: Buffer[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as { write: (chunk: string | Uint8Array, ...args: unknown[]) => boolean }).write = (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    try {
      await processSourceFiles(stub, "development", false);
    } finally {
      process.stderr.write = originalWrite;
    }
    const stderrOutput = Buffer.concat(stderrChunks).toString();
    expect(stderrOutput).toContain("[sops-decrypt] skip ");
    expect(stderrOutput).toContain("file not found");
    expect(stderrOutput).toContain("definitely-missing.sops");
  });
});
