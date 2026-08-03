import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock at module level
vi.mock("@/lib/cognito/access-token-verification", () => ({
  verifyCognitoAccessToken: vi.fn(),
}))

vi.mock("@/lib/cognito/env", () => ({
  tryGetCognitoEnv: vi.fn().mockReturnValue({
    userPoolId: "pool",
    clientId: "client",
    hostedUiDomain: "tastile",
    issuer: "issuer",
    jwksUrl: "jwks",
    hostedUiBaseUrl: "hosted",
    region: "ap-northeast-1",
    callbackUrl: "callback",
    logoutUrl: "logout",
  }),
}))

vi.mock("@/lib/account/api-token-session", () => ({
  coreUrl: vi.fn().mockReturnValue("https://core.example"),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/mobile/api-token", () => {
  it("rejects requests without a Cognito access token", async () => {
    vi.mocked(vi.importActual("@/lib/cognito/access-token-verification")).verifyCognitoAccessToken.mockResolvedValueOnce(null)
    const { POST } = await import("./route")
    const fetchMock = vi.spyOn(globalThis, "fetch")
    
    const response = await POST(
      new Request("https://app.test/api/mobile/api-token", { method: "POST" }),
    )
    
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a token Cognito does not verify", async () => {
    vi.mocked(vi.importActual("@/lib/cognito/access-token-verification")).verifyCognitoAccessToken.mockResolvedValueOnce(null)
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

  it("mints for the verified sub using only the server-side bridge secret", async () => {
    vi.mocked(vi.importActual("@/lib/cognito/access-token-verification")).verifyCognitoAccessToken.mockResolvedValueOnce("verified-sub")
    const { POST } = await import("./route")
    const fetchMock = vi.spyOn(globalThis, "fetch")
    
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: "token-id", token: "raw-token", label: "android-client" }),
    )
    
    const response = await POST(
      new Request("https://app.test/api/mobile/api-token", {
        method: "POST",
        headers: { authorization: "Bearer verified-access-token" },
      }),
    )
    
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ token: "raw-token", token_id: "token-id" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://core.example/v1/api-tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-tastile-web-bridge-secret": "server-only-secret",
          "x-tastile-web-session-user": "verified-sub",
        }),
      }),
    )
  })
})
