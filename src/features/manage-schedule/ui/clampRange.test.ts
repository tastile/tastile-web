// src/components/schedule/__tests__/clampRange.test.ts
import { describe, expect, it, vi } from "vitest";
import { clampRange } from './clampRange';

describe("clampRange", () => {
  it("passes through ranges <= maxDays", () => {
    const r = { start: "2026-07-30T00:00:00Z", end: "2026-08-05T00:00:00Z" };
    expect(clampRange(r, 31)).toEqual(r);
  });

  it("clamps to maxDays when exceeded", () => {
    const r = { start: "2026-07-30T00:00:00Z", end: "2026-09-30T00:00:00Z" };
    const out = clampRange(r, 31);
    const startMs = new Date(out.start).getTime();
    const endMs = new Date(out.end).getTime();
    expect((endMs - startMs) / 86_400_000).toBeCloseTo(31, 1);
  });

  it("warns once on clamp", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = { start: "2026-07-30T00:00:00Z", end: "2026-09-30T00:00:00Z" };
    clampRange(r, 31);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
