// Polling helpers for v1 e2e specs.  v1 side-effects (worker tick, lazy
// expand, decision session close, delivery retry) do not block the HTTP
// request, so specs that need a follow-up read or DB row to settle must
// retry the probe until the predicate holds.  All pollers default to a
// 5s / 100ms cadence; pass options to override.

export interface PollUntilOptions<T> {
  /** Predicate that returns true when the polled value has settled. */
  predicate: (value: T) => boolean;
  /** Total timeout in milliseconds.  Defaults to 5000. */
  timeoutMs?: number;
  /** Poll interval in milliseconds.  Defaults to 100. */
  intervalMs?: number;
  /** Optional label included in the timeout error message. */
  label?: string;
}

export class PollTimeoutError extends Error {
  constructor(label: string, elapsedMs: number, lastValue: unknown) {
    const valueText = (() => {
      try {
        return JSON.stringify(lastValue);
      } catch {
        return String(lastValue);
      }
    })();
    super(`[${label}] poll timed out after ${elapsedMs}ms; last value=${valueText}`);
    this.name = "PollTimeoutError";
  }
}

/**
 * Repeatedly call `fn` until `predicate(value)` returns true, the deadline
 * expires, or `fn` throws.  Returns the first value that satisfies the
 * predicate.  Throws PollTimeoutError (re-thrown) on timeout.  Re-throws
 * non-predicate errors immediately (they're not retryable).
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  opts: PollUntilOptions<T>,
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const intervalMs = opts.intervalMs ?? 100;
  const label = opts.label ?? "pollUntil";
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    const value = await fn();
    lastValue = value;
    if (opts.predicate(value)) return value;
    await sleep(intervalMs);
  }
  throw new PollTimeoutError(label, timeoutMs, lastValue);
}

/**
 * Convenience: poll until `fn()` returns null, undefined, an empty array,
 * or `0` (numeric count).  Used for "row is gone" / "list is drained"
 * checks where any falsy value settles the test.  Treats 0 / [] as
 * "gone" because that is the v1 read model contract for a settled state.
 */
export async function pollUntilGone<T>(
  fn: () => Promise<T | null | undefined>,
  opts: Omit<PollUntilOptions<T | null | undefined>, "predicate"> & {
    /** Override the "gone" detection; defaults to falsy for any T. */
    isGone?: (value: T | null | undefined) => boolean;
  },
): Promise<T | null | undefined> {
  const isGone = opts.isGone ?? ((v) => v == null || (Array.isArray(v) ? v.length === 0 : false));
  return pollUntil(fn, {
    ...opts,
    predicate: (v) => {
      // Cast through unknown so the predicate is callable with any value
      // the caller is willing to accept.  isGone handles the type-narrow.
      return isGone(v as T | null | undefined);
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
