import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserSubFromCookies = vi.fn();
const getSubscriptionForUser = vi.fn();

vi.mock("@/lib/cognito/cookies", () => ({ getUserSubFromCookies }));
vi.mock("@/lib/billing/server", () => ({ getSubscriptionForUser }));

beforeEach(() => {
  getUserSubFromCookies.mockReset();
  getSubscriptionForUser.mockReset();
  vi.resetModules();
});


describe("GET /api/billing/subscription", () => {
  it("returns 401 when not authenticated", async () => {
    getUserSubFromCookies.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
    expect(getSubscriptionForUser).not.toHaveBeenCalled();
  });

  it("returns the subscription state for the authed sub", async () => {
    getUserSubFromCookies.mockResolvedValueOnce("sub-abc");
    getSubscriptionForUser.mockResolvedValueOnce({
      status: "active",
      interval: "monthly",
      priceId: "price_1",
      customerId: "cus_1",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toEqual({
      status: "active",
      interval: "monthly",
      priceId: "price_1",
      customerId: "cus_1",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    });
    expect(getSubscriptionForUser).toHaveBeenCalledWith("sub-abc");
  });

  it("passes through the free state", async () => {
    getUserSubFromCookies.mockResolvedValueOnce("sub-xyz");
    getSubscriptionForUser.mockResolvedValueOnce({ status: "free" });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toEqual({ status: "free" });
  });
});
