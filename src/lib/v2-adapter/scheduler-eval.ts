import { spawn } from "node:child_process";

// T13 v2 adapter: invokes the local `tastile-v2` CLI as a subprocess and
// normalizes its typed JSON contract into a web-facing result. The adapter
// never recomputes scheduler logic itself and never reports a v1-derived
// value as a v2 success.
//
// Contract (core origin/main 39919003, `tastile-v2 run --help`):
//   tastile-v2 run [OPTIONS] <LOCK>
//     --store <DIR>            store directory
//     --input <PORT=VALUE>     repeatable; str ports take raw text, others JSON
//     --fuel <N>               per-node fuel budget
//     --memory-mb <N>          per-node memory limit (MiB)
//     --timeout-ms <N>         per-node wall-clock limit (ms)
//   exit code 0 on success, 1..8 typed ErrorKind otherwise; stdout is one
//   pretty JSON document with `status` and `root` provides values.

const SCHEDULER_OPTION_PORTS = [
  "step_ms",
  "span_ms",
  "origin",
  "bounds_start",
  "bounds_end",
  "range_start_ms",
  "range_end_ms",
] as const;

type SchedulerOptionPort = (typeof SCHEDULER_OPTION_PORTS)[number];

const INT_PORTS = new Set<SchedulerOptionPort>([
  "step_ms",
  "span_ms",
  "range_start_ms",
  "range_end_ms",
]);
const OPTION_INT_PORTS = new Set<SchedulerOptionPort>([
  "origin",
  "bounds_start",
  "bounds_end",
]);

export interface SchedulerEvalInput {
  step_ms: number;
  span_ms: number;
  origin: number | null;
  bounds_start: number | null;
  bounds_end: number | null;
  range_start_ms: number;
  range_end_ms: number;
}

export type V2SchedulerResult =
  | {
      engine: "v2";
      ok: true;
      occurrences: number[][];
      count: number;
      diagnostics: Record<string, unknown>;
    }
  | { engine: "v2"; ok: false; error: { code: string; message: string } }
  | { engine: "fallback"; ok: false; fallback_reason: string }
  | { engine: "disabled" };

export interface V2AdapterConfig {
  cliPath: string;
  storeDir: string;
  lockPath: string;
  /** Whole-subprocess wall-clock cap. Default 10s. */
  subprocessTimeoutMs: number;
}

// Fixed resource envelope. Request input cannot raise these values.
const V2_FUEL = "5000000";
const V2_MEMORY_MB = "128";
const V2_TIMEOUT_MS = "3000";
const DEFAULT_SUBPROCESS_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_EVALUATIONS = 2;
const MAX_STDOUT_BYTES = 1_048_576;

export function v2AdapterConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): V2AdapterConfig | null {
  const cliPath = env.TASTILE_V2_CLI;
  const storeDir = env.TASTILE_V2_STORE;
  const lockPath = env.TASTILE_V2_LOCK;
  if (!cliPath || !storeDir || !lockPath) return null;
  const timeout = Number(env.TASTILE_V2_TIMEOUT_MS);
  return {
    cliPath,
    storeDir,
    lockPath,
    subprocessTimeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? Math.floor(timeout)
        : DEFAULT_SUBPROCESS_TIMEOUT_MS,
  };
}

let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<() => void> {
  if (inFlight < MAX_CONCURRENT_EVALUATIONS) {
    inFlight += 1;
    return release;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight += 1;
  return release;
}

function release(): void {
  inFlight -= 1;
  const next = waiters.shift();
  next?.();
}

function buildArgs(config: V2AdapterConfig, input: SchedulerEvalInput): string[] {
  const args = [
    "run",
    "--store",
    config.storeDir,
    "--fuel",
    V2_FUEL,
    "--memory-mb",
    V2_MEMORY_MB,
    "--timeout-ms",
    V2_TIMEOUT_MS,
  ];
  for (const port of SCHEDULER_OPTION_PORTS) {
    const value = input[port];
    if (value === null) {
      if (OPTION_INT_PORTS.has(port)) args.push("--input", `${port}=null`);
      continue;
    }
    args.push("--input", `${port}=${JSON.stringify(value)}`);
  }
  args.push(config.lockPath);
  return args;
}

interface V2RunPayload {
  status?: unknown;
  root?: unknown;
  nodes?: unknown;
  error?: unknown;
}

function isIntMatrix(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        Array.isArray(row) && row.every((cell) => Number.isInteger(cell)),
    )
  );
}

function normalizePayload(payload: V2RunPayload): V2SchedulerResult {
  if (payload.status !== "success") {
    const err = (payload.error ?? {}) as { code?: unknown; kind?: unknown; message?: unknown };
    const code =
      typeof err.code === "string"
        ? err.code
        : typeof err.kind === "string"
          ? err.kind
          : "v2_failure";
    const message = typeof err.message === "string" ? err.message : code;
    return { engine: "v2", ok: false, error: { code, message } };
  }
  const root = (payload.root ?? {}) as Record<string, unknown>;
  if (!isIntMatrix(root.occurrences) || !Number.isInteger(root.count)) {
    return {
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_output_shape_mismatch",
    };
  }
  return {
    engine: "v2",
    ok: true,
    occurrences: root.occurrences,
    count: root.count as number,
    diagnostics:
      typeof payload.nodes === "object" && payload.nodes !== null
        ? (payload.nodes as Record<string, unknown>)
        : {},
  };
}

function runOnce(
  config: V2AdapterConfig,
  args: string[],
): Promise<{ code: number | null; stdout: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(config.cliPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      // Grandchildren may inherit the stdio pipes; destroy them so `close`
      // can fire instead of waiting for the orphaned process to exit.
      child.stdout.destroy();
      child.stderr.destroy();
    }, config.subprocessTimeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_STDOUT_BYTES) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 65_536) stderr += chunk.toString("utf8");
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => {
      if (stderr.trim().length > 0 && stdout.trim().length === 0) {
        stdout = stderr;
      }
      finish(code);
    });
  });
}

export async function evaluateSchedulerV2(
  config: V2AdapterConfig,
  input: SchedulerEvalInput,
): Promise<V2SchedulerResult> {
  const releaseSlot = await acquireSlot();
  try {
    const { code, stdout, timedOut } = await runOnce(
      config,
      buildArgs(config, input),
    );
    if (timedOut) {
      return { engine: "fallback", ok: false, fallback_reason: "v2_timeout" };
    }
    if (code === null) {
      return { engine: "fallback", ok: false, fallback_reason: "v2_spawn_failed" };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(stdout);
    } catch {
      return {
        engine: "fallback",
        ok: false,
        fallback_reason: "v2_output_unparseable",
      };
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return {
        engine: "fallback",
        ok: false,
        fallback_reason: "v2_output_shape_mismatch",
      };
    }
    const result = normalizePayload(payload as V2RunPayload);
    if (result.engine === "v2" && result.ok === false) {
      // Non-zero exit with a typed CLI error payload is still a v2 failure,
      // not an adapter fallback.
      return result;
    }
    if (code !== 0 && !(result.engine === "v2" && !result.ok)) {
      return { engine: "fallback", ok: false, fallback_reason: "v2_exit_nonzero" };
    }
    return result;
  } finally {
    releaseSlot();
  }
}
