/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

// Create mock implementations
const mockResolveAuthenticatedUserSub = vi.fn()
const mockGetSubscriptionForUser = vi.fn()

// Mock the modules BEFORE any imports use them
vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: mockResolveAuthenticatedUserSub,
}))

vi.mock("@/lib/billing/server", () => ({
  getSubscriptionForUser: mockGetSubscriptionForUser,
}))

// Import the route AFTER mocks are set up
const { GET } = await import("./route")

beforeEach(() => {
  mockResolveAuthenticatedUserSub.mockReset()
  mockGetSubscriptionForUser.mockReset()
})

describe("GET /api/billing/subscription", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolveAuthenticatedUserSub.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Unauthorized/)
    expect(mockGetSubscriptionForUser).not.toHaveBeenCalled()
  })

  it("returns the subscription state for the authed sub", async () => {
    mockResolveAuthenticatedUserSub.mockResolvedValueOnce("sub-abc")
    mockGetSubscriptionForUser.mockResolvedValueOnce({
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
    expect(mockGetSubscriptionForUser).toHaveBeenCalledWith("sub-abc")
  })

  it("returns 404 when user has no subscription", async () => {
    mockResolveAuthenticatedUserSub.mockResolvedValueOnce("sub-abc")
    mockGetSubscriptionForUser.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/No active subscription/)
  })

  it("passes through the free state", async () => {
    mockResolveAuthenticatedUserSub.mockResolvedValueOnce("sub-xyz")
    mockGetSubscriptionForUser.mockResolvedValueOnce({ status: "free" })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription).toEqual({ status: "free" })
  })
})
