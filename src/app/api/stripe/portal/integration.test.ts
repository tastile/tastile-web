// W06 #81 release-evidence integration test for the /api/stripe/portal
// route's 200 path.  Round-3 review (5190446973) flagged that the
// existing route.test.ts uses module-level mocks of getStripe() and
// getSubscriptionForUser(), so it doesn't prove the production
// Stripe SDK actually talks to a working Stripe transport.
//
// This integration test stands up a minimal Stripe HTTP server inside
// the vitest worker, points the real getStripe() at it via
// STRIPE_API_HOST / STRIPE_API_PORT, and exercises the production
// route handler end-to-end.  The Stripe SDK's transport layer
// (auth headers, URL building, response parsing) runs against real
// HTTP — only the Stripe-side response bodies are scripted.
//
// What this proves:
//   - The real /api/stripe/portal handler reaches the real Stripe SDK
//     transport and receives the fixture portal session URL.
//   - The Stripe SDK → mock Stripe server round-trip works for the
//     paid-user → billing_portal.sessions.create path.
//
// What this does NOT prove (and why it's acceptable):
//   - It does not query a real Stripe customer / subscription base to
//     assert 0 paid users exist in this dev env.  Proving 0 paid
//     users requires operator-provided STRIPE_SECRET_KEY against a
//     Stripe test-mode account; we cannot do that from inside the
//     agent loop without secrets.  This test instead proves the route
//     shape that production will exercise.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

const PORTAL_URL = "https://billing.stripe.com/test/session/cs_test_1";

const FIXTURE_PAID_SUBSCRIPTION = {
  status: "active",
  interval: "monthly",
  priceId: "price_test_monthly",
  customerId: "cus_test_42",
  currentPeriodEnd: 1_900_000_000,
  cancelAtPeriodEnd: false,
};

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  let requestCount = 0;
  const requestLog: string[] = [];
  server = http.createServer((req, res) => {
    requestCount++;
    void (async () => {
      const body = await readBody(req);
      const url = req.url ?? "";
      const auth = req.headers.authorization ?? "";
      requestLog.push(`${req.method} ${url} auth=${auth.slice(0, 12)} body=${body.slice(0, 200)}`);
      if (!auth.startsWith("Bearer ")) {
        res.statusCode = 401;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: { type: "authentication_error" } }));
        return;
      }

      // /v1/customers/search — return a fixture paid customer
      // whose metadata matches the user id the route will request.
      // The Stripe SDK uses GET with the query in the URL.
      if (url.startsWith("/v1/customers/search")) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            object: "search_result",
            data: [
              {
                id: "cus_test_42",
                object: "customer",
                metadata: { tastile_user_id: "sub-portal-it" },
              },
            ],
            has_more: false,
            url: "/v1/customers/search",
          }),
        );
        return;
      }

      // GET /v1/subscriptions — return a paid subscription for the
      // fixture customer.
      if (url.startsWith("/v1/subscriptions") && req.method === "GET") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            object: "list",
            data: [
              {
                id: "sub_test_42",
                object: "subscription",
                status: "active",
                customer: "cus_test_42",
                cancel_at_period_end: false,
                items: {
                  data: [
                    {
                      id: "si_test_42",
                      price: { id: FIXTURE_PAID_SUBSCRIPTION.priceId },
                      current_period_end: FIXTURE_PAID_SUBSCRIPTION.currentPeriodEnd,
                    },
                  ],
                },
              },
            ],
            has_more: false,
            url: "/v1/subscriptions",
          }),
        );
        return;
      }

      // POST /v1/billing_portal/sessions — return the fixture portal URL.
      if (
        url.startsWith("/v1/billing_portal/sessions") &&
        req.method === "POST"
      ) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            id: "bps_test_1",
            object: "billing_portal.session",
            customer: "cus_test_42",
            created: 1_700_000_000,
            livemode: false,
            return_url:
              "https://app.example.test/dashboard/preferences/account?tab=subscription",
            url: PORTAL_URL,
          }),
        );
        return;
      }

      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            type: "invalid_request_error",
            message: `unhandled: ${req.method} ${url} body=${body}`,
          },
        }),
      );
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
  // Expose a counter via a side channel so the test can assert the
  // mock server received the expected sequence of requests.
  (globalThis as unknown as { __STRIPE_MOCK_REQUESTS__?: () => number }).__STRIPE_MOCK_REQUESTS__ = () => requestCount;
  (globalThis as unknown as { __STRIPE_MOCK_LOG__?: () => string[] }).__STRIPE_MOCK_LOG__ = () => requestLog;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("W06 #81 portal integration (real route, real Stripe SDK against mock Stripe HTTP)", () => {
  it("returns 200 + portal URL for an authenticated paid user", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_it";
    process.env.STRIPE_API_HOST = "127.0.0.1";
    process.env.STRIPE_API_PORT = baseUrl.split(":").pop();
    process.env.STRIPE_API_PROTOCOL = "http";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";

    // BetterAuth's getSession() requires a real Next.js request context;
    // the auth path is independently covered by route.test.ts.  Mock
    // the resolver here so the production route handler runs end-to-end
    // against the real Stripe SDK with no other seams.
    vi.resetModules();
    const resolveAuthenticatedUserSub = vi.fn().mockResolvedValue("sub-portal-it");
    vi.doMock("@/shared/auth/authenticated-session", () => ({
      resolveAuthenticatedUserSub,
    }));

    const { POST } = await import("./route");
    const res = await POST();

    const requestCount = (
      globalThis as unknown as { __STRIPE_MOCK_REQUESTS__?: () => number }
    ).__STRIPE_MOCK_REQUESTS__?.();
    expect(requestCount, "Stripe SDK should have hit the mock server").toBeGreaterThan(
      0,
    );

    expect(res.status, "expected 200 for paid user with mocked Stripe HTTP").toBe(200);
    const body = (await res.json()) as { url?: string };
    expect(body.url).toBe(PORTAL_URL);

    vi.doUnmock("@/shared/auth/authenticated-session");
  });
});
