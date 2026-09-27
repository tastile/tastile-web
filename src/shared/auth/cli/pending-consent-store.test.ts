import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      return queryMock(...args);
    }
  }
  return { Pool: FakePool };
});

const ORIGINAL_ENV = process.env;

function setupClient(): void {
  connectMock.mockResolvedValueOnce({ query: queryMock, release: releaseMock });
}

describe("pending-consent-store (mocked pg.Pool)", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      TASTILE_AUTH_DATABASE_URL: "postgres://test:test@localhost/db",
    };
    queryMock.mockReset();
    releaseMock.mockReset();
    connectMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("insertPendingConsent", () => {
    it("writes a row with expires_at = NOW() + ttl and returns the new UUID", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { insertPendingConsent } = await import("./pending-consent-store");
      const tid = await insertPendingConsent({
        userSub: "user-1",
        clientId: "tastile-cli",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
        scopesRequested: "tastile.read tastile.write",
        scopesEffective: "tastile.read tastile.write",
        state: "csrf-state",
        responseType: "code",
        ttlSeconds: 300,
      });
      expect(tid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
      );
      const insertCall = queryMock.mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("INSERT INTO web_cli_auth_pending_consent"),
      );
      expect(insertCall?.[0]).toContain("INTERVAL '1 second'");
      expect(insertCall?.[1]?.[1]).toBe("user-1");
      expect(insertCall?.[1]?.[2]).toBe("tastile-cli");
      expect(insertCall?.[1]?.[9]).toBe(300);
    });
  });

  describe("loadPendingConsent", () => {
    it("returns ok on a fresh row", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            user_sub: "user-1",
            client_id: "tastile-cli",
            code_challenge: "challenge-1",
            redirect_uri: "http://127.0.0.1:1234/callback",
            scopes_effective: "tastile.read tastile.write",
            state: "csrf",
            response_type: "code",
          },
        ],
        rowCount: 1,
      });
      const { loadPendingConsent } = await import("./pending-consent-store");
      const result = await loadPendingConsent("tid");
      expect(result).toEqual({
        status: "ok",
        userSub: "user-1",
        clientId: "tastile-cli",
        codeChallenge: "challenge-1",
        redirectUri: "http://127.0.0.1:1234/callback",
        scopesEffective: "tastile.read tastile.write",
        state: "csrf",
        responseType: "code",
      });
    });

    it("returns missing when the row is gone", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // fresh
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // follow-up
      const { loadPendingConsent } = await import("./pending-consent-store");
      const result = await loadPendingConsent("tid");
      expect(result).toEqual({ status: "missing" });
    });

    it("returns consumed when consumed_at is set", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          { consumed_at: new Date(), expires_at: new Date(Date.now() + 60_000) },
        ],
        rowCount: 1,
      });
      const { loadPendingConsent } = await import("./pending-consent-store");
      const result = await loadPendingConsent("tid");
      expect(result).toEqual({ status: "consumed" });
    });

    it("returns expired when expires_at has passed", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      queryMock.mockResolvedValueOnce({
        rows: [
          { consumed_at: null, expires_at: new Date(Date.now() - 1_000) },
        ],
        rowCount: 1,
      });
      const { loadPendingConsent } = await import("./pending-consent-store");
      const result = await loadPendingConsent("tid");
      expect(result).toEqual({ status: "expired" });
    });
  });

  describe("markPendingConsumed", () => {
    it("returns true on the first consumer (rowCount=1)", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const { markPendingConsumed } = await import("./pending-consent-store");
      const ok = await markPendingConsumed("tid");
      expect(ok).toBe(true);
      const updateCall = queryMock.mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("UPDATE web_cli_auth_pending_consent"),
      );
      expect(updateCall?.[0]).toContain("WHERE id = $1 AND consumed_at IS NULL");
    });

    it("returns false on a second consumer (rowCount=0)", async () => {
      setupClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { markPendingConsumed } = await import("./pending-consent-store");
      const ok = await markPendingConsumed("tid");
      expect(ok).toBe(false);
    });
  });
});
