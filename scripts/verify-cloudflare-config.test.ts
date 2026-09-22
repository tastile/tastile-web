import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const verifier = resolve("scripts/verify-cloudflare-config.mts");

function runVerifier(args: string[]) {
  const directory = mkdtempSync(join(tmpdir(), "cloudflare-config-test-"));
  const configPath = join(directory, "wrangler.json");
  const config = JSON.parse(readFileSync(resolve("wrangler.jsonc"), "utf8"));
  config.main = relative(dirname(configPath), resolve(".open-next/worker.js")).replaceAll("\\", "/");
  config.env.preview.hyperdrive[0].id = "preview-hyperdrive-id";
  config.env.preview.vars.NEXT_PUBLIC_APP_URL = "https://tastile-web-preview.rebuild-up-up.workers.dev";
  config.env.staging.hyperdrive[0].id = "staging-hyperdrive-id";
  config.env.staging.vars.NEXT_PUBLIC_APP_URL = "https://staging.app.tastile.app";
  config.env.staging.name = "unexpected-staging-worker";
  writeFileSync(configPath, JSON.stringify(config));

  try {
    return spawnSync("bun", [verifier, configPath, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Cloudflare config verifier CLI", () => {
  it("checks preview and staging when --env is omitted", () => {
    const result = runVerifier([]);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("staging Worker name is incorrect");
  });

  it("checks only the environment named by --env", () => {
    const result = runVerifier(["--env", "preview"]);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain("Cloudflare config verified");
  });

  it("rejects --env without an environment name", () => {
    const result = runVerifier(["--env"]);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("--env requires an environment name");
  });
});
