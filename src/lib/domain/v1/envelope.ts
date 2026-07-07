/**
 * v1 Command Envelope — types and helpers.
 *
 * Source: tastile-core/v1/14-read-model-and-endpoint.md §1.
 *
 * All aggregates are identified by UUIDv7. Timestamps are ISO-8601 UTC
 * (millisecond precision, trailing `Z`).
 */

import type { AggregateKindValue } from "./constants";
import type { ResolutionViolation } from "./placement";

// ---------- helpers ----------

/** Read a byte at a known-good index of a fixed-size Uint8Array. */
function byteAt(buf: Uint8Array, index: number): number {
  return buf[index] ?? 0;
}

/**
 * RFC 9562 UUIDv7 generator.
 *
 * Layout (128 bits):
 *   - 48 bits: Unix epoch milliseconds (big-endian)
 *   -  4 bits: version = 0x7
 *   - 12 bits: monotonic counter (within this ms, occasionally reseeded)
 *   -  2 bits: variant = 0b10
 *   - 62 bits: rand_b (random)
 *
 * Monotonicity: a per-process 12-bit counter guarantees that two consecutive
 * calls within the same millisecond produce strictly increasing UUIDs.
 * `crypto.getRandomValues` provides all randomness — the counter is only
 * used as an ordering field and reseeded from `crypto` when the timestamp
 * advances.
 */
let lastTs = -1;
let counter = 0;

export function uuidv7(): string {
  const tsMs = Date.now();

  if (tsMs === lastTs) {
    counter = (counter + 1) & 0x0fff;
  } else {
    lastTs = tsMs;
    // Reseed counter from crypto to mix a fresh random low bits across ms.
    const seed = new Uint8Array(2);
    crypto.getRandomValues(seed);
    // Indices 0 and 1 are guaranteed by the fixed-size allocation above.
    counter = ((byteAt(seed, 0) << 4) | (byteAt(seed, 1) >>> 4)) & 0x0fff;
  }

  // 8 random bytes (64 bits) for the trailing rand_b (62 bits used).
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);

  const tsHex = tsMs.toString(16).padStart(12, "0");
  // byte6: version nibble 0x7 + top 4 bits of counter.
  const byte6 = 0x70 | ((counter >>> 8) & 0x0f);
  // byte7: low 8 bits of counter.
  const byte7 = counter & 0xff;
  // byte8: variant 0b10 + top 6 bits of rand[0].
  const byte8 = 0x80 | (byteAt(rand, 0) & 0x3f);
  // bytes 9..15: rand[1..7].
  const bytes = new Uint8Array([
    byte6,
    byte7,
    byte8,
    byteAt(rand, 1),
    byteAt(rand, 2),
    byteAt(rand, 3),
    byteAt(rand, 4),
    byteAt(rand, 5),
    byteAt(rand, 6),
    byteAt(rand, 7),
  ]);

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  return (
    tsHex.slice(0, 8) +
    "-" +
    tsHex.slice(8, 12) +
    "-" +
    hex.slice(0, 4) +
    "-" +
    hex.slice(4, 8) +
    "-" +
    hex.slice(8, 20)
  );
}

/**
 * Current instant as ISO-8601 UTC with millisecond precision and trailing `Z`.
 * Equivalent to `new Date().toISOString()`.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

// ---------- envelope types (interfaces only — no business logic) ----------

export interface CommandRequest<T> {
  expectedRevision: number | null;
  idempotencyKey: string;
  occurredAt: string;
  payload: T;
}

export interface AggregateRef {
  kind: AggregateKindValue;
  id: string;
}

export interface PendingWork {
  kind: number;
  target: AggregateRef | null;
  notBefore: string | null;
}

export interface AggregateMeta {
  tileId: string | null;
  planId: string | null;
  recurringId: string | null;
  frameRuleId: string | null;
  changesetId: string | null;
  changeIds: string[];
}

export interface CommandResponse {
  commandId: string;
  acceptedAt: string;
  aggregate: AggregateRef | null;
  revision: number | null;
  /** CommandResult numeric value. See `constants.ts` `CommandResult`. */
  result: number;
  pending: PendingWork[];
  /**
   * Server-side id slots.  v1 servers assign UUIDv7 for
   * tile_id / plan_id / recurring_id / frame_rule_id /
   * changeset_id / change_ids and echo them here so the
   * frontend can read canonical ids without an additional GET.
   * Optional — older API versions may omit the field.
   */
  aggregateMeta?: AggregateMeta | null;
}

export interface ApiError {
  /** ApiErrorKind numeric value. See `constants.ts` `ApiErrorKind`. */
  kind: number;
  message: string;
  currentRevision: number | null;
  violations: ResolutionViolation[];
}
