import { beforeEach, describe, expect, it, vi } from "vitest";

// The bootstrap result is cached at module level, so each test loads a fresh
// copy of the module.
async function loadEnsure() {
  const mod = await import("./better-auth-jwks");
  return mod.ensureBetterAuthJwksSchema;
}

describe("ensureBetterAuthJwksSchema", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates the jwks table once and reuses the result", async () => {
    const ensure = await loadEnsure();
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));

    await ensure({ query });
    await ensure({ query });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "jwks"'),
    );
  });

  it("retries after a failed bootstrap instead of caching the failure", async () => {
    const ensure = await loadEnsure();
    const query = vi
      .fn<(sql: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(ensure({ query })).rejects.toThrow("permission denied");
    await expect(ensure({ query })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
