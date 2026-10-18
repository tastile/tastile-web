import { afterEach, describe, expect, it } from "vitest";

import { localDateToIso } from "./local-date";

const originalTz = process.env.TZ;

describe("localDateToIso", () => {
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("reads the picked date in the local calendar, not as UTC midnight", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(localDateToIso("2026-10-20", "")).toBe("2026-10-19T15:00:00.000Z");
  });

  it("keeps the local time-of-day already chosen", () => {
    process.env.TZ = "Asia/Tokyo";
    const current = "2026-10-19T09:30:00.000Z"; // 18:30 JST
    expect(localDateToIso("2026-10-21", current)).toBe("2026-10-21T09:30:00.000Z");
  });

  it("accepts a picker value with a time suffix and rejects other input", () => {
    process.env.TZ = "UTC";
    expect(localDateToIso("2026-10-20 00:00:00", "")).toBe("2026-10-20T00:00:00.000Z");
    expect(localDateToIso("20/10/2026", "")).toBe("");
    expect(localDateToIso("", "")).toBe("");
  });
});
