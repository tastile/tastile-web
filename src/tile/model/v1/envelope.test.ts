import { describe, it, expect } from "vitest";
import { uuidv7, nowIso } from "./envelope";

describe("uuidv7", () => {
  it("matches RFC 9562 UUIDv7 format", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is monotonically increasing between consecutive calls", () => {
    const a = uuidv7();
    const b = uuidv7();
    expect(b > a).toBe(true);
  });

  it("encodes 48-bit ms timestamp in the first 12 hex chars", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    // First 48 bits = first 12 hex chars (8 + 1 dash + 4-1 = 12 chars before version nibble)
    const tsHex = id.slice(0, 8) + id.slice(9, 13);
    const tsMs = Number.parseInt(tsHex, 16);
    expect(tsMs).toBeGreaterThanOrEqual(before);
    expect(tsMs).toBeLessThanOrEqual(after);
  });

  it("has version 7 and variant 8/9/a/b in the marker positions", () => {
    const id = uuidv7();
    expect(id.charAt(14)).toBe("7");
    expect("89ab").toContain(id.charAt(19));
  });
});

describe("nowIso", () => {
  it("matches ISO-8601 UTC format with milliseconds and Z", () => {
    const s = nowIso();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("ends with Z (UTC)", () => {
    expect(nowIso().endsWith("Z")).toBe(true);
  });

  it("matches `new Date().toISOString()` to the second", () => {
    const before = new Date();
    const s = nowIso();
    const after = new Date();
    expect(s >= before.toISOString()).toBe(true);
    expect(s <= after.toISOString()).toBe(true);
  });
});