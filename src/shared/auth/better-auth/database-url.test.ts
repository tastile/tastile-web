import { describe, expect, it } from "vitest";

import { resolveAuthDatabaseUrl } from "./database-url";

describe("resolveAuthDatabaseUrl", () => {
  it("prefers the explicit auth database URL", () => {
    expect(resolveAuthDatabaseUrl(" postgres://direct ", "postgres://hyperdrive")).toBe(
      "postgres://direct",
    );
  });

  it("falls back to the Cloudflare Hyperdrive URL", () => {
    expect(resolveAuthDatabaseUrl(undefined, " postgres://hyperdrive ")).toBe(
      "postgres://hyperdrive",
    );
  });

  it("fails closed when neither database URL is configured", () => {
    expect(resolveAuthDatabaseUrl("  ", "")).toBeNull();
  });
});
