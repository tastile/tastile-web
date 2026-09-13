#!/usr/bin/env bun
// Local fork of tastile-root/scripts/sops-decrypt.ts.
// Drops AWS (STS / KMS / credential-provider-node) and uses an age recipient
// loaded from $SOPS_AGE_KEY_FILE (default: ~/.config/sops/age/keys.txt).
// See scripts/sops.config.ts for the rationale and the recipient value.
import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { config, type SopsEnvConfig } from "./sops.config";

export type EnvName = "development" | "staging" | "production";
export type ErrorCode = 1 | 2 | 3 | 4 | 5 | 6;

export type DecryptResult = {
  source: string;
  target: string;
  env: EnvName;
  age_recipient: string;
  ts: string;
  size: number;
};

class SopsError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, msg: string) {
    super(msg);
    this.name = "SopsError";
    this.code = code;
  }
}

function throwError(code: ErrorCode, msg: string): never {
  process.stderr.write(`[sops-decrypt] ${msg}\n`);
  throw new SopsError(code, msg);
}

// @internal — exported for tests only
export function parseArgs(argv: string[]): { env: string; check: boolean } {
  let env = process.env.TASTILE_ENV ?? "";
  let check = false;
  for (const arg of argv) {
    if (arg === "--check") check = true;
    else if (arg.startsWith("--env=")) env = arg.slice("--env=".length);
  }
  if (!env)
    throwError(
      2,
      "--env=<development|staging|production> or TASTILE_ENV is required",
    );
  if (!(env in config))
    throwError(
      2,
      `unknown env "${env}"; valid: ${Object.keys(config).join(", ")}`,
    );
  return { env, check };
}

// @internal — exported for tests only
export function loadConfig(env: string): SopsEnvConfig {
  const entry = config[env];
  if (!entry) throwError(2, `config missing for env "${env}"`);
  return entry;
}

// @internal — exported for tests only
export async function assertSopsInstalled(): Promise<void> {
  const probe = spawn("sh", ["-c", "command -v sops"], { stdio: "pipe" });
  await new Promise<void>((resolve, reject) => {
    probe.on("error", () =>
      reject(
        new SopsError(
          2,
          "sops CLI not installed; see docs/runbooks/sops-install.md",
        ),
      ),
    );
    probe.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new SopsError(2, `command -v sops exited ${code}`)),
    );
  });
}

// @internal — exported for tests only
export async function assertAgeKey(
  keyFile: string = process.env.SOPS_AGE_KEY_FILE ??
    join(homedir(), ".config", "sops", "age", "keys.txt"),
): Promise<void> {
  try {
    await stat(keyFile);
  } catch {
    throwError(
      3,
      `age key not found at ${keyFile}; set SOPS_AGE_KEY_FILE or run age-keygen first (see docs/runbooks/sops-rotation.md)`,
    );
  }
}

// @internal — exported for tests only
export function decryptOne(
  source: string,
  target: string,
  cfg: SopsEnvConfig,
  cliCheck: boolean,
  env: EnvName,
): Promise<DecryptResult> {
  return new Promise<DecryptResult>((resolvePromise, reject) => {
    const child = spawn("sops", ["--decrypt", source], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", (e) => {
      const msg = `failed to spawn sops: ${e.message}`;
      process.stderr.write(`[sops-decrypt] ${msg}\n`);
      reject(new SopsError(4, msg));
    });
    child.on("exit", async (code) => {
      if (code !== 0) {
        const msg = `sops --decrypt ${source} exited ${code}; stderr=${Buffer.concat(err).toString()}`;
        process.stderr.write(`[sops-decrypt] ${msg}\n`);
        return reject(new SopsError(4, msg));
      }
      const size = Buffer.concat(out).length;
      const result: DecryptResult = {
        source,
        target,
        env,
        age_recipient: cfg.ageRecipient,
        ts: new Date().toISOString(),
        size,
      };
      if (cliCheck) {
        return resolvePromise(result);
      }
      try {
        await mkdir(dirname(resolve(target)), { recursive: true });
        await writeFile(resolve(target), Buffer.concat(out), { mode: 0o600 });
        await chmod(resolve(target), 0o600);
        resolvePromise(result);
      } catch (e) {
        const msg = `write ${target} failed: ${(e as Error).message}`;
        process.stderr.write(`[sops-decrypt] ${msg}\n`);
        reject(new SopsError(6, msg));
      }
    });
  });
}

async function main(): Promise<void> {
  const { env, check } = parseArgs(process.argv.slice(2));
  await assertSopsInstalled();
  await assertAgeKey();
  const cfg = loadConfig(env);
  await processSourceFiles(cfg, env as EnvName, check);
}

// @internal — exported for tests only
export async function processSourceFiles(
  cfg: SopsEnvConfig,
  env: EnvName,
  check: boolean,
): Promise<void> {
  for (const { source: src, target: dst } of cfg.pairs) {
    try {
      await stat(src);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        process.stderr.write(`[sops-decrypt] skip ${src}: file not found\n`);
        continue;
      }
      throwError(4, `stat ${src} failed: ${(e as Error).message}`);
    }
    const result = await decryptOne(src, dst, cfg, check, env);
    process.stdout.write(JSON.stringify({ event: "decrypt", ...result }) + "\n");
  }
}

if (import.meta.main) {
  main().catch((e) => {
    const code = (e as { code?: number }).code ?? 1;
    process.stderr.write(`[sops-decrypt] fatal: ${(e as Error).message}\n`);
    process.exit(code);
  });
}
