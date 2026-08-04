import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
const RETURN_URL = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/preferences/account?tab=subscription`;

const resolveAuthenticatedUserSub = vi.fn();
const getSubscriptionForUser = vi.fn();
const billingPortalSessionsCreate = vi.fn();

vi.mock("@/shared/auth/authenticated-session", () => ({ resolveAuthenticatedUserSub }));
vi.mock("@/lib/billing/server", () => ({ getSubscriptionForUser }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: billingPortalSessionsCreate } } }),
}));

beforeEach(() => {
  resolveAuthenticatedUserSub.mockReset();
  getSubscriptionForUser.mockReset();
  billingPortalSessionsCreate.mockReset();
  vi.resetModules();
});

describe("POST /api/stripe/portal", () => {
  it("returns 401 when not authenticated", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(401);
    expect(billingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when user has no subscription", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("sub-1");
    getSubscriptionForUser.mockResolvedValueOnce({ status: "free" });
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/No active subscription/);
    expect(billingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a portal session and returns the URL", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("sub-2");
    getSubscriptionForUser.mockResolvedValueOnce({
      status: "active",
      interval: "monthly",
      priceId: "price_monthly",
      customerId: "cus_42",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    });
    billingPortalSessionsCreate.mockResolvedValueOnce({ url: "https://billing.stripe.com/session" });
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://billing.stripe.com/session");
    expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_42",
      return_url: RETURN_URL,
    });
  });
});
