import { describe, expect, it } from "vitest";
import { validInstant, datePart } from "./quick-create-schedule-wire";

describe("validInstant", () => {
  it("normalizes ISO8601 with timezone offset to UTC", () => {
    // 09:00+09:00 = 00:00 UTC
    expect(validInstant("2026-08-03T09:00:00+09:00")).toBe("2026-08-03T00:00:00.000Z");
  });

  it("passes through UTC ISO8601 string", () => {
    expect(validInstant("2026-08-03T09:00:00Z")).toBe("2026-08-03T09:00:00.000Z");
  });

  it("converts date-only string to ISO instant using local midnight", () => {
    // "2026-08-03" → new Date("2026-08-03T00:00:00") → local midnight → UTC
    // In UTC+9: local midnight = 15:00 UTC previous day
    const result = validInstant("2026-08-03");
    expect(result).toMatch(/^2026-08-0[23]T\d{2}:00:00\.000Z$/);
  });

  it("returns null for empty string", () => {
    expect(validInstant("")).toBeNull();
  });

  it("returns null for non-date string", () => {
    expect(validInstant("not-a-date")).toBeNull();
  });

  it("returns null for invalid date components", () => {
    expect(validInstant("2026-13-99T99:99:99Z")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(validInstant(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(validInstant(undefined)).toBeNull();
  });
});

describe("datePart", () => {
  it("passes through YYYY-MM-DD string unchanged", () => {
    expect(datePart("2026-08-03")).toBe("2026-08-03");
  });

  it("extracts date part from non-zero-padded date (Node.js accepts it)", () => {
    // Node.js Date.parse accepts "2026-08-3" → validInstant converts → slice(0,10)
    const result = datePart("2026-08-3");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("extracts date part from slash-separated date (Node.js accepts it)", () => {
    // Node.js Date.parse accepts "2026/08/03" → validInstant converts → slice(0,10)
    const result = datePart("2026/08/03");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns null for empty string", () => {
    expect(datePart("")).toBeNull();
  });

  it("returns null for invalid string", () => {
    expect(datePart("invalid")).toBeNull();
  });

  it("extracts date part from ISO8601 with offset", () => {
    // "2026-08-03T09:00:00+09:00" → UTC = "2026-08-03T00:00:00Z" → slice = "2026-08-03"
    expect(datePart("2026-08-03T09:00:00+09:00")).toBe("2026-08-03");
  });

  it("returns null for null input", () => {
    expect(datePart(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(datePart(undefined)).toBeNull();
  });
});
