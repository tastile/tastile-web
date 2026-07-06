import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_monthly_test";
process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_yearly_test";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

const customersSearch = vi.fn();
const subscriptionsList = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    customers: { search: customersSearch },
    subscriptions: { list: subscriptionsList },
  }),
}));

beforeEach(() => {
  customersSearch.mockReset();
  subscriptionsList.mockReset();
  vi.resetModules();
});

describe("getSubscriptionForUser", () => {
  it("returns free when no customer is found", async () => {
    customersSearch.mockResolvedValueOnce({ data: [] });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    const state = await getSubscriptionForUser("sub-1");
    expect(state).toEqual({ status: "free" });
    expect(customersSearch).toHaveBeenCalledWith({
      query: "metadata['cognito_sub']:'sub-1'",
      limit: 1,
    });
  });

  it("returns free when customer exists but has no subscriptions", async () => {
    customersSearch.mockResolvedValueOnce({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValueOnce({ data: [] });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    const state = await getSubscriptionForUser("sub-2");
    expect(state).toEqual({ status: "free" });
  });

  it("returns active subscription for monthly price", async () => {
    customersSearch.mockResolvedValueOnce({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValueOnce({
      data: [
        {
          id: "sub_1",
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: { id: "price_monthly_test" },
                current_period_end: 1700000000,
              },
            ],
          },
        },
      ],
    });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    const state = await getSubscriptionForUser("sub-3");
    expect(state).toEqual({
      status: "active",
      interval: "monthly",
      priceId: "price_monthly_test",
      customerId: "cus_1",
      currentPeriodEnd: 1700000000,
      cancelAtPeriodEnd: false,
    });
  });

  it("returns yearly interval for the yearly price ID", async () => {
    customersSearch.mockResolvedValueOnce({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValueOnce({
      data: [
        {
          id: "sub_1",
          status: "active",
          cancel_at_period_end: true,
          items: {
            data: [
              {
                price: { id: "price_yearly_test" },
                current_period_end: 1800000000,
              },
            ],
          },
        },
      ],
    });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    const state = await getSubscriptionForUser("sub-4");
    expect(state).toMatchObject({
      status: "active",
      interval: "yearly",
      cancelAtPeriodEnd: true,
    });
  });

  it("escapes single quotes in the cognito sub when searching", async () => {
    customersSearch.mockResolvedValueOnce({ data: [] });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    await getSubscriptionForUser("abc'd");
    expect(customersSearch).toHaveBeenCalledWith({
      query: "metadata['cognito_sub']:'abc\'d'",
      limit: 1,
    });
  });

  it("falls back to free on Stripe errors", async () => {
    customersSearch.mockRejectedValueOnce(new Error("stripe down"));
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    const state = await getSubscriptionForUser("sub-5");
    expect(state).toEqual({ status: "free" });
  });

  it("caches the result for 60 seconds", async () => {
    customersSearch.mockResolvedValue({ data: [] });
    const { getSubscriptionForUser, invalidateSubscriptionCache } =
      await import("./server");
    invalidateSubscriptionCache();
    await getSubscriptionForUser("sub-6");
    await getSubscriptionForUser("sub-6");
    expect(customersSearch).toHaveBeenCalledTimes(1);
  });
});

describe("invalidateSubscriptionCache", () => {
  it("clears cache for one sub when called with sub", async () => {
    customersSearch.mockResolvedValue({ data: [] });
    const mod = await import("./server");
    mod.invalidateSubscriptionCache();
    await mod.getSubscriptionForUser("sub-A");
    await mod.getSubscriptionForUser("sub-B");
    expect(customersSearch).toHaveBeenCalledTimes(2);
    mod.invalidateSubscriptionCache("sub-A");
    await mod.getSubscriptionForUser("sub-A");
    await mod.getSubscriptionForUser("sub-B");
    expect(customersSearch).toHaveBeenCalledTimes(3);
  });
});
