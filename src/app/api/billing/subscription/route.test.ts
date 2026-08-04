import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock at module level
const mockResolve = vi.fn()
const mockGetSubscription = vi.fn()

vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: mockResolve,
}))

vi.mock("@/lib/billing/server", () => ({
  getSubscriptionForUser: mockGetSubscription,
}))

beforeEach(() => {
  mockResolve.mockReset()
  mockGetSubscription.mockReset()
})

describe("GET /api/billing/subscription", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolve.mockResolvedValueOnce(null)
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Unauthorized/)
    expect(mockGetSubscription).not.toHaveBeenCalled()
  })

  it("returns the subscription state for the authed sub", async () => {
    const { GET } = await import("./route")
    mockResolve.mockResolvedValueOnce("sub-abc")
    mockGetSubscription.mockResolvedValueOnce({
      status: "active",
      interval: "monthly",
      priceId: "price_1",
      customerId: "cus_1",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription).toEqual({
      status: "active",
      interval: "monthly",
      priceId: "price_1",
      customerId: "cus_1",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    })
    expect(mockGetSubscription).toHaveBeenCalledWith("sub-abc")
  })

  it("returns 404 when user has no subscription", async () => {
    const { GET } = await import("./route")
    mockResolve.mockResolvedValueOnce("sub-abc")
    mockGetSubscription.mockResolvedValueOnce(null as never)
    const res = await GET()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/No active subscription/)
  })

  it("passes through the free state", async () => {
    const { GET } = await import("./route")
    mockResolve.mockResolvedValueOnce("sub-xyz")
    mockGetSubscription.mockResolvedValueOnce({ status: "free" })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription).toEqual({ status: "free" })
  })
})
