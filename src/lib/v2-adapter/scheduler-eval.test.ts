import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateSchedulerV2,
  v2AdapterConfigFromEnv,
  type V2AdapterConfig,
} from "./scheduler-eval";

const dirs: string[] = [];

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "v2-adapter-"));
  dirs.push(dir);
  return dir;
}

function fakeCli(dir: string, stdoutJson: string, exitCode = 0): string {
  const out = join(dir, "fake-v2-out.json");
  writeFileSync(out, stdoutJson);
  const script = join(dir, "fake-tastile-v2.sh");
  writeFileSync(
    script,
    `#!/bin/sh\ncat "${out}"\nexit ${exitCode}\n`,
  );
  chmodSync(script, 0o755);
  return script;
}

function config(cliPath: string, overrides: Partial<V2AdapterConfig> = {}): V2AdapterConfig {
  return {
    cliPath,
    storeDir: "/tmp/v2-store",
    lockPath: "/tmp/v2.lock.json",
    subprocessTimeoutMs: 5_000,
    ...overrides,
  };
}

const INPUT = {
  step_ms: 3600000,
  span_ms: 1800000,
  origin: 1767225600000,
  bounds_start: null,
  bounds_end: null,
  range_start_ms: 1767231000000,
  range_end_ms: 1767236400000,
};

const SUCCESS_PAYLOAD = JSON.stringify({
  status: "success",
  root: { occurrences: [[1, 2]], count: 1 },
  nodes: { evaluated: 1 },
});

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("v2AdapterConfigFromEnv", () => {
  it("returns null when any required env is missing", () => {
    expect(v2AdapterConfigFromEnv({})).toBeNull();
    expect(
      v2AdapterConfigFromEnv({ TASTILE_V2_CLI: "/bin/true" }),
    ).toBeNull();
  });

  it("reads config and default timeout", () => {
    const cfg = v2AdapterConfigFromEnv({
      TASTILE_V2_CLI: "/bin/true",
      TASTILE_V2_STORE: "/s",
      TASTILE_V2_LOCK: "/l",
    });
    expect(cfg).toEqual({
      cliPath: "/bin/true",
      storeDir: "/s",
      lockPath: "/l",
      subprocessTimeoutMs: 10_000,
    });
  });
});

describe("evaluateSchedulerV2", () => {
  it("returns typed v2 success with normalized occurrences", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, SUCCESS_PAYLOAD);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "v2",
      ok: true,
      occurrences: [[1, 2]],
      count: 1,
      diagnostics: { evaluated: 1 },
    });
  });

  it("returns typed v2 failure for non-success status payload", async () => {
    const dir = tmpDir();
    const cli = fakeCli(
      dir,
      JSON.stringify({
        status: "failure",
        error: { kind: "ResourceLimit", message: "fuel exhausted" },
      }),
      4,
    );
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "v2",
      ok: false,
      error: { code: "ResourceLimit", message: "fuel exhausted" },
    });
  });

  it("returns fallback when stdout is not JSON", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, "not json at all", 1);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_output_unparseable",
    });
  });

  it("returns fallback when the binary is missing", async () => {
    const res = await evaluateSchedulerV2(
      config(join(tmpDir(), "does-not-exist")),
      INPUT,
    );
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_spawn_failed",
    });
  });

  it("returns fallback on subprocess timeout", async () => {
    const dir = tmpDir();
    const script = join(dir, "slow-v2.sh");
    writeFileSync(script, "#!/bin/sh\nsleep 30\n");
    chmodSync(script, 0o755);
    const res = await evaluateSchedulerV2(
      config(script, { subprocessTimeoutMs: 200 }),
      INPUT,
    );
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_timeout",
    });
  }, 15_000);

  it("returns fallback when stdout JSON is not an object", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, "null", 0);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_output_shape_mismatch",
    });
  });

  it("returns fallback when provides shape mismatches", async () => {
    const dir = tmpDir();
    const cli = fakeCli(
      dir,
      JSON.stringify({ status: "success", root: { occurrences: "bad", count: 1 } }),
    );
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_output_shape_mismatch",
    });
  });
});
