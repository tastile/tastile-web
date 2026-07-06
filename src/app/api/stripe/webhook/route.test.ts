import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";

const constructEvent = vi.fn();
const invalidateSubscriptionCache = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));
vi.mock("@/lib/billing/server", () => ({ invalidateSubscriptionCache }));

beforeEach(() => {
  constructEvent.mockReset();
  invalidateSubscriptionCache.mockReset();
  vi.resetModules();
});

function makeRequest(body: string, sig: string | null) {
  const headers: Record<string, string> = {};
  if (sig !== null) headers["stripe-signature"] = sig;
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when the signature header is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("{}", null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing signature/);
  });

  it("returns 400 when signature verification fails", async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error("bad sig");
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest("{}", "t=0,v1=bad"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid signature/);
  });

  it("extracts cognito_sub from client_reference_id and invalidates cache", async () => {
    constructEvent.mockReturnValueOnce({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "user-42", customer: "cus_1", subscription: "sub_1" } },
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest("ok", "t=1,v1=ok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user-42");
  });

  it("extracts cognito_sub from subscription metadata", async () => {
    constructEvent.mockReturnValueOnce({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x", customer: "cus_x", metadata: { cognito_sub: "user-99" } } },
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest("ok", "t=1,v1=ok"));
    expect(res.status).toBe(200);
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user-99");
  });

  it("tolerates events with no cognito_sub (no cache invalidate)", async () => {
    constructEvent.mockReturnValueOnce({
      id: "evt_3",
      type: "ping",
      data: { object: {} },
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest("ok", "t=1,v1=ok"));
    expect(res.status).toBe(200);
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();
  });
});
