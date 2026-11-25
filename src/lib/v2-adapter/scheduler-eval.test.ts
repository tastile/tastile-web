import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
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

// v1-expand artifact shape: typed domain `status` port, no `count` port.
const V1_EXPAND_PAYLOAD = JSON.stringify({
  status: "success",
  root: { status: "ok", occurrences: [[10, 20], [30, 40]] },
  nodes: { evaluated: 1 },
});

const V1_EXPAND_UNSUPPORTED_PAYLOAD = JSON.stringify({
  status: "success",
  root: { status: "unsupported", occurrences: [] },
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
    expect(res).toMatchObject({
      engine: "v2",
      ok: true,
      occurrences: [[1, 2]],
      count: 1,
      diagnostics: { evaluated: 1 },
    });
    expect((res as { elapsed_ms?: number }).elapsed_ms).toEqual(
      expect.any(Number),
    );
  });

  it("passes through the v1-expand typed status and derives count", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, V1_EXPAND_PAYLOAD);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toMatchObject({
      engine: "v2",
      ok: true,
      status: "ok",
      occurrences: [
        [10, 20],
        [30, 40],
      ],
      count: 2,
    });
  });

  it("keeps a typed unsupported status as a v2 result, not a fallback", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, V1_EXPAND_UNSUPPORTED_PAYLOAD);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toMatchObject({
      engine: "v2",
      ok: true,
      status: "unsupported",
      occurrences: [],
      count: 0,
    });
  });

  it("returns fallback when the status shape lacks occurrences", async () => {
    const dir = tmpDir();
    const cli = fakeCli(
      dir,
      JSON.stringify({
        status: "success",
        root: { status: "ok", occurrences: "bad" },
      }),
    );
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_output_shape_mismatch",
    });
  });

  it("returns fallback for success payload on a nonzero exit", async () => {
    const dir = tmpDir();
    const cli = fakeCli(dir, SUCCESS_PAYLOAD, 3);
    const res = await evaluateSchedulerV2(config(cli), INPUT);
    expect(res).toEqual({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_exit_nonzero",
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
    expect(res).toMatchObject({
      engine: "v2",
      ok: false,
      error: { code: "ResourceLimit", message: "fuel exhausted" },
    });
    expect((res as { elapsed_ms?: number }).elapsed_ms).toEqual(
      expect.any(Number),
    );
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

  it("clamps TASTILE_V2_TIMEOUT_MS into a sane range", () => {
    const base = {
      TASTILE_V2_CLI: "/bin/true",
      TASTILE_V2_STORE: "/s",
      TASTILE_V2_LOCK: "/l",
    };
    expect(
      v2AdapterConfigFromEnv({ ...base, TASTILE_V2_TIMEOUT_MS: "999999999" })
        ?.subprocessTimeoutMs,
    ).toBe(60_000);
    expect(
      v2AdapterConfigFromEnv({ ...base, TASTILE_V2_TIMEOUT_MS: "5" })
        ?.subprocessTimeoutMs,
    ).toBe(100);
    expect(
      v2AdapterConfigFromEnv({ ...base, TASTILE_V2_TIMEOUT_MS: "garbage" })
        ?.subprocessTimeoutMs,
    ).toBe(10_000);
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

  it("does not leak server secrets into the subprocess environment", async () => {
    const dir = tmpDir();
    const envOut = join(dir, "child-env.txt");
    const payloadOut = join(dir, "payload.json");
    writeFileSync(payloadOut, SUCCESS_PAYLOAD);
    const script = join(dir, "env-dump-v2.sh");
    writeFileSync(
      script,
      `#!/bin/sh\nenv > "${envOut}"\ncat "${payloadOut}"\n`,
    );
    chmodSync(script, 0o755);
    const prev = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "super-secret-value";
    try {
      const res = await evaluateSchedulerV2(config(script), INPUT);
      expect(res).toMatchObject({ engine: "v2", ok: true });
      const childEnv = readFileSync(envOut, "utf8");
      expect(childEnv).not.toContain("super-secret-value");
      expect(childEnv).not.toContain("BETTER_AUTH_SECRET");
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_SECRET;
      else process.env.BETTER_AUTH_SECRET = prev;
    }
  });

  it("fails fast with v2_busy when the waiter queue is saturated", async () => {
    const dir = tmpDir();
    const script = join(dir, "slow-v2.sh");
    writeFileSync(script, "#!/bin/sh\nsleep 1\ncat /dev/null\nexit 1\n");
    chmodSync(script, 0o755);
    // 2 slots + 8 queued = 10 in system; the 11th must be rejected
    // immediately rather than queued unboundedly.
    const pending = Array.from({ length: 11 }, () =>
      evaluateSchedulerV2(config(script), INPUT),
    );
    const results = await Promise.all(pending);
    const busy = results.filter(
      (r) => r.engine === "fallback" && r.fallback_reason === "v2_busy",
    );
    expect(busy.length).toBeGreaterThanOrEqual(1);
  }, 20_000);
});
