import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserSub = vi.fn();
const getSubscriptionForUser = vi.fn();

vi.mock("@/lib/cognito/authenticated-session", () => ({ resolveAuthenticatedUserSub }));
vi.mock("@/lib/billing/server", () => ({ getSubscriptionForUser }));

beforeEach(() => {
  resolveAuthenticatedUserSub.mockReset();
  getSubscriptionForUser.mockReset();
  vi.resetModules();
});


describe("GET /api/billing/subscription", () => {
  it("returns 401 when not authenticated", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
    expect(getSubscriptionForUser).not.toHaveBeenCalled();
  });

  it("returns the subscription state for the authed sub", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("sub-abc");
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
    resolveAuthenticatedUserSub.mockResolvedValueOnce("sub-xyz");
    getSubscriptionForUser.mockResolvedValueOnce({ status: "free" });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toEqual({ status: "free" });
  });
});
