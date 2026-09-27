import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Migration bootstrap is mocked to a no-op so the store tests exercise only
// the grant-store SQL. The integration test (grant-store.integration.test.ts)
// exercises the real `ensureWebCliGrantsSchema` against a real Postgres.
vi.mock("@/lib/migrations/web-cli-grants", () => ({
  ensureWebCliGrantsSchema: vi.fn().mockResolvedValue(undefined),
}));

const queryMock = vi.fn();
const releaseMock = vi.fn();
const connectMock = vi.fn();

vi.mock("pg", () => {
  class FakePool {
    public connect = connectMock;
    constructor(_config: unknown) {}
    async query(...args: unknown[]) {
      // Forward to the test-controlled mock.
      return queryMock(...args);
    }
  }
  return { Pool: FakePool };
});

const ORIGINAL_ENV = process.env;

// Each store call opens its own short-lived client from `pool.connect()`.
// Tests attach `setupClient()` before the operation under test so connect
// resolves to a fake client carrying the test-controlled query/release.
function setupClient(): void {
  connectMock.mockResolvedValueOnce({ query: queryMock, release: releaseMock });
}

describe("grant-store (mocked pg.Pool)", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      TASTILE_AUTH_DATABASE_URL: "postgres://test:test@localhost/db",
    };
    queryMock.mockReset();
    releaseMock.mockReset();
    connectMock.mockReset();
    // Reset the module-level pool cache so each test gets a fresh Pool.
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("insertGrant", () => {
    it("hashes the code with sha256 and writes TTL via NOW() + interval", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { insertGrant } = await import("./grant-store");
      await insertGrant({
        code: "PLAIN-CODE-DO-NOT-LOG",
        clientId: "tastile-cli",
        userSub: "user-1",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
        scopesRequested: "tastile.read tastile.write",
        scopesEffective: "tastile.read tastile.write",
        ttlSeconds: 300,
      });

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO web_cli_auth_grant"),
        [
          // hashGrantCode("PLAIN-CODE-DO-NOT-LOG") → sha256 hex
          expect.stringMatching(/^[0-9a-f]{64}$/u),
          "tastile-cli",
          "user-1",
          "challenge-1",
          "http://127.0.0.1:1234/callback",
          "tastile.read tastile.write",
          "tastile.read tastile.write",
          300,
        ],
      );
      // The SQL itself encodes the 1-second interval.
      const insertCall = queryMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO web_cli_auth_grant"),
      );
      expect(insertCall?.[0]).toContain("INTERVAL '1 second'");
    });

    it("does not log or echo the plaintext code", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { insertGrant } = await import("./grant-store");
      await insertGrant({
        code: "SECRET-CODE",
        clientId: "tastile-cli",
        userSub: "u",
        codeChallenge: "c",
        redirectUri: "http://127.0.0.1:1/callback",
        scopesRequested: "tastile.read",
        scopesEffective: "tastile.read",
        ttlSeconds: 300,
      });
      const combined = JSON.stringify(warn.mock.calls);
      expect(combined).not.toContain("SECRET-CODE");
      warn.mockRestore();
    });
  });

  describe("consumeGrantOnce", () => {
    it("returns status=ok on rowCount=1 with the user/client/scopes", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            user_sub: "user-1",
            client_id: "tastile-cli",
            scopes_effective: "tastile.read tastile.write",
          },
        ],
        rowCount: 1,
      });
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({
        status: "ok",
        userSub: "user-1",
        clientId: "tastile-cli",
        scopesEffective: "tastile.read tastile.write",
      });
    });

    it("classifies rowCount=0 + no follow-up row as invalid_grant", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // follow-up
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({ status: "invalid_grant" });
    });

    it("classifies used_at set as already_used", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            used_at: new Date(),
            expires_at: new Date(Date.now() + 60_000),
            code_challenge: "challenge-1",
            redirect_uri: "http://127.0.0.1:1234/callback",
            client_id: "tastile-cli",
          },
        ],
        rowCount: 1,
      });
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({ status: "already_used" });
    });

    it("classifies expires_at <= now as gone", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            used_at: null,
            expires_at: new Date(Date.now() - 1_000),
            code_challenge: "challenge-1",
            redirect_uri: "http://127.0.0.1:1234/callback",
            client_id: "tastile-cli",
          },
        ],
        rowCount: 1,
      });
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({ status: "gone" });
    });

    it("classifies code_challenge mismatch as pkce_mismatch", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            used_at: null,
            expires_at: new Date(Date.now() + 60_000),
            code_challenge: "WRONG",
            redirect_uri: "http://127.0.0.1:1234/callback",
            client_id: "tastile-cli",
          },
        ],
        rowCount: 1,
      });
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({ status: "pkce_mismatch" });
    });

    it("classifies redirect_uri mismatch as redirect_uri_mismatch", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            used_at: null,
            expires_at: new Date(Date.now() + 60_000),
            code_challenge: "challenge-1",
            redirect_uri: "http://127.0.0.1:9999/callback",
            client_id: "tastile-cli",
          },
        ],
        rowCount: 1,
      });
      const { consumeGrantOnce } = await import("./grant-store");
      const result = await consumeGrantOnce({
        code: "ANY",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      expect(result).toEqual({ status: "redirect_uri_mismatch" });
    });

    it("does not echo the plaintext code in error paths", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { consumeGrantOnce } = await import("./grant-store");
      await consumeGrantOnce({
        code: "PLAINTEXT-DO-NOT-LEAK",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
      });
      const combined = JSON.stringify(warn.mock.calls);
      expect(combined).not.toContain("PLAINTEXT-DO-NOT-LEAK");
      warn.mockRestore();
    });
  });

  describe("markCoreTokenId", () => {
    it("runs a single UPDATE keyed on code_hash", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { markCoreTokenId } = await import("./grant-store");
      await markCoreTokenId("HASH-VALUE", "core-token-id");
      const updateCall = queryMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("UPDATE web_cli_auth_grant"),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall?.[1]).toEqual(["HASH-VALUE", "core-token-id"]);
    });
  });
});
