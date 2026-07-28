import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const APP_BASE_URL = "https://app.tastile.test";

describe("api account direct-mode", () => {
  it("POST sets tastile_direct_daemon=1 cookie when user is logged in", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "POST",
      headers: { cookie: "tastile_uid=cognito-sub-abc" },
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tastile_direct_daemon=1");
    expect(setCookie.toLowerCase()).toMatch(/path=\//);
    // Toggle cookie is JS-readable, not httpOnly
    expect(setCookie.toLowerCase()).not.toContain("httponly");
  });

  it("POST returns 401 when user has no auth cookie", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "POST",
    });

    const response = await route.POST(request);
    expect(response.status).toBe(401);
  });

  it("DELETE clears tastile_direct_daemon cookie when user is logged in", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "DELETE",
      headers: { cookie: "tastile_api_token=any; tastile_uid=cognito-sub-abc" },
    });

    const response = await route.DELETE(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tastile_direct_daemon=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("DELETE returns 401 when user has no auth cookie", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "DELETE",
    });

    const response = await route.DELETE(request);
    expect(response.status).toBe(401);
  });
});
