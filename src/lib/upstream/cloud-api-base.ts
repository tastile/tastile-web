/**
 * Single source of truth for the v1 Rust core base URL.
 *
 * Replaces hardcoded core URL literals that used to appear across the web
 * source. The public open-source build must NOT ship a baked-in default;
 * callers use `getCloudApiBase({ assert })`, which:
 *
 *   - Reads `process.env.CLOUD_API_BASE` (or `TASTILE_RUST_API_URL` as
 *     a backwards-compatible alias for code that already used it).
 *   - By default, throws when `CLOUD_API_BASE` is unset.
 */

export class MissingRequiredEnvError extends Error {
  constructor(public readonly variable: string) {
    super(
      `Missing environment variable ${variable} — please set it in .env.<profile> (see .env.*.example).`,
    );
    this.name = "MissingRequiredEnvError";
  }
}

export class MissingCloudApiBaseError extends MissingRequiredEnvError {
  constructor() {
    super("CLOUD_API_BASE");
    this.name = "MissingCloudApiBaseError";
  }
}

export interface GetCloudApiBaseOptions {
  /**
   * When `true`, throw `MissingCloudApiBaseError` if the env var is
   * missing. Use this from any server route that actually issues a
   * fetch to the v1 core — failing fast at request time keeps the
   * `next build` analysis working without committing a default.
   */
  assert?: boolean;
}

/**
 * Read the configured v1 Rust core base URL.
 *
 * Priority:
 *   1. `CLOUD_API_BASE` (preferred — matches the systemd EnvironmentFile
 *      documented in tastile-web/docs/HARNESS.md §13).
 *   2. `TASTILE_RUST_API_URL` (legacy alias used by `events.ts` callers).
 *   3. Empty string — non-asserting callers decide how to handle it.
 */
export function getCloudApiBase(options: GetCloudApiBaseOptions = {}): string {
  const value =
    process.env.CLOUD_API_BASE?.trim() ?? process.env.TASTILE_RUST_API_URL?.trim() ?? "";

  if (value) return value.replace(/\/$/, "");

  if (options.assert) throw new MissingCloudApiBaseError();

  return "";
}
