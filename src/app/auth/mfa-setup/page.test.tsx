/** @vitest-environment jsdom */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderWithMantine } from "@/test/render-with-mantine";

// The child Client Component imports `next/navigation` and `useLocaleStore`.
// Mock both so the test does not need the Next app-router runtime or the
// Zustand persist boundary.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/stores/locale-store", () => ({
  useLocaleStore: vi.fn(() => ({ locale: "ja", setLocale: vi.fn() })),
}));

const setupCalls: Array<{ url: string; init?: RequestInit }> = [];

function installFetch(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) => {
      const target = typeof url === "string" ? url : url.toString();
      if (target.endsWith("/api/account/mfa/setup")) {
        setupCalls.push({ url: target });
      }
      return handler(target);
    }),
  );
}

function okSetupResponse(secret = "BASE32SECRET"): Response {
  return new Response(
    JSON.stringify({
      secretCode: secret,
      otpauthUrl: `otpauth://totp/Tastile:user?secret=${secret}&issuer=Tastile`,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  setupCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderPage(searchParams: Promise<Record<string, unknown>>) {
  // Dynamic import keeps the test independent from the runtime import order
  // and avoids pulling in `@mantine/*` providers via the client component.
  const { default: MfaSetupPage } = await import("./page");
  const element = await MfaSetupPage({ searchParams });
  renderWithMantine(element as ReactElement);
}

describe("MfaSetupPage (Server Component)", () => {
  it("awaits async searchParams and renders the MfaSetupClient child", async () => {
    installFetch(() => okSetupResponse("ABC"));
    await renderPage(Promise.resolve({ email: "alice@example.com" }));

    // The MfaSetupClient triggers a POST to /api/account/mfa/setup on mount
    // and renders the secretCode as proof the child rendered.
    await waitFor(() => {
      expect(screen.getByTestId("secret").textContent).toContain("ABC");
    });
    expect(setupCalls).toHaveLength(1);
    expect(setupCalls[0].url).toContain("/api/account/mfa/setup");
  });

  it("normalizes a string[] email by taking the first value", async () => {
    installFetch(() => okSetupResponse("XYZ"));
    await renderPage(
      Promise.resolve({ email: ["bob@example.com", "carol@example.com"] }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("secret").textContent).toContain("XYZ");
    });
    // The guide line interpolates the email — proves we passed through the
    // first value rather than coercing the array as text.
    expect(screen.getByText("bob@example.com", { exact: false })).toBeTruthy();
  });

  it("normalizes a missing email to an empty string without throwing", async () => {
    installFetch(() => okSetupResponse("NONE"));
    await renderPage(Promise.resolve({}));

    await waitFor(() => {
      expect(screen.getByTestId("secret").textContent).toContain("NONE");
    });
    // No crash; the email span renders as empty.
    const emailSpan = document.querySelector("span.font-mono") as HTMLElement;
    expect(emailSpan.textContent).toBe("");
  });
});
