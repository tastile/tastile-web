import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Top-level mock: the migration lazy-evaluates `new Pool({ connectionString })`
// from `pg`, so we replace the constructor with a fake.  `connectMock`,
// `queryMock`, `releaseMock`, `endMock` are exposed via vi.mocked() so each
// test can reset + configure the call records.
const connectMock = vi.fn();
const queryMock = vi.fn();
const releaseMock = vi.fn();
const endMock = vi.fn();

vi.mock("pg", () => {
  class FakePool {
    public connect = connectMock;
    public end = endMock;
    constructor(_config: unknown) {}
  }
  return { Pool: FakePool };
});

const ORIGINAL_ENV = process.env;

describe("ensureWebCliGrantsSchema", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, TASTILE_AUTH_DATABASE_URL: "postgres://test:test@localhost/db" };
    connectMock.mockReset();
    queryMock.mockReset();
    releaseMock.mockReset();
    endMock.mockReset();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("runs DDL + version insert inside a single transaction", async () => {
    const { ensureWebCliGrantsSchema } = await import("./web-cli-grants");
    connectMock.mockResolvedValueOnce({ query: queryMock, release: releaseMock });
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });

    await ensureWebCliGrantsSchema();

    expect(connectMock).toHaveBeenCalledOnce();
    const calls = queryMock.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe("BEGIN");
    expect(calls.at(-1)).toBe("COMMIT");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS web_cli_auth_grant"),
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS web_cli_auth_pending_consent"),
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS web_cli_auth_migration"),
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO web_cli_auth_migration"),
      ["V1__web_cli_auth_grant"],
    );
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the client on failure", async () => {
    const { ensureWebCliGrantsSchema } = await import("./web-cli-grants");
    connectMock.mockResolvedValue({ query: queryMock, release: releaseMock });
    queryMock.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") return { rows: [] };
      throw new Error("ddl failed");
    });

    await expect(ensureWebCliGrantsSchema()).rejects.toThrow("ddl failed");
    expect(releaseMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls.some((c) => c[0] === "ROLLBACK")).toBe(true);
  });

  it("is idempotent — running twice does not throw", async () => {
    const { ensureWebCliGrantsSchema } = await import("./web-cli-grants");
    connectMock.mockResolvedValue({ query: queryMock, release: releaseMock });
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });

    await ensureWebCliGrantsSchema();
    await ensureWebCliGrantsSchema();
    // Pool cached inside the module — single Pool instance is fine.
    expect(connectMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
