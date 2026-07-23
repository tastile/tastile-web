import { describe, expect, it } from "vitest";
import { profileQueryOptions, safeSessionQueryOptions } from "./Header";

describe("Header query options", () => {
  it("uses stable, distinct keys for session and profile metadata", () => {
    expect(safeSessionQueryOptions.queryKey).toEqual(["auth", "safe-session"]);
    expect(profileQueryOptions.queryKey).toEqual(["account", "profile"]);
  });

  it("does not retry failed best-effort metadata requests", () => {
    expect(safeSessionQueryOptions.retry).toBe(false);
    expect(profileQueryOptions.retry).toBe(false);
  });
});
