import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock at module level: the route resolves the caller via the BetterAuth
// session (bearer() plugin accepts `Authorization: Bearer <sessionToken>`).
const mockGetSession = vi.fn()

vi.mock("@/shared/auth/better-auth/server", () => ({
  getAuth: () => ({
    api: {
      getSession: mockGetSession,
    },
  }),
}))

vi.mock("@/lib/account/api-token-session", () => ({
  coreUrl: vi.fn().mockReturnValue("https://core.example"),
}))

process.env.TASTILE_WEB_BRIDGE_SECRET = "server-only-secret"

beforeEach(() => {
  mockGetSession.mockReset()
})

describe("POST /api/mobile/api-token", () => {
  it("rejects requests without a bearer session token", async () => {
    mockGetSession.mockResolvedValueOnce(null)
    const { POST } = await import("./route")
    const fetchMock = vi.spyOn(globalThis, "fetch")

    const response = await POST(
      new Request("https://app.test/api/mobile/api-token", { method: "POST" }),
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a token BetterAuth does not verify", async () => {
    mockGetSession.mockResolvedValueOnce(null)
    const { POST } = await import("./route")
    const fetchMock = vi.spyOn(globalThis, "fetch")

    const response = await POST(
      new Request("https://app.test/api/mobile/api-token", {
        method: "POST",
        headers: { authorization: "Bearer forged-token" },
      }),
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("mints for the verified user using only the server-side bridge secret", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "server-only-secret"
    mockGetSession.mockResolvedValueOnce({
      user: { id: "verified-user-id", email: "a@b.c" },
      session: { expiresAt: new Date(Date.now() + 60_000) },
    })
    const { POST } = await import("./route")
    const fetchMock = vi.spyOn(globalThis, "fetch")

    fetchMock.mockResolvedValueOnce(
      Response.json({ id: "token-id", token: "raw-token", label: "android-client" }),
    )

    const response = await POST(
      new Request("https://app.test/api/mobile/api-token", {
        method: "POST",
        headers: { authorization: "Bearer verified-session-token" },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ token: "raw-token", token_id: "token-id" })
    expect(mockGetSession).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://core.example/v1/api-tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-tastile-web-bridge-secret": "server-only-secret",
          "x-tastile-web-session-user": "verified-user-id",
        }),
      }),
    )
  })
})
