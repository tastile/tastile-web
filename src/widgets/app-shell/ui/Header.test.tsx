/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { Header } from "./Header";

vi.mock("@/features/execute-tile/ui/ActiveExecutionBar", () => ({
  ActiveExecutionBar: () => null,
}));

vi.mock("@/app/app/account-menu", () => ({
  AccountMenu: () => null,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Header identity fetch", () => {
  function buildFetchMock(opts: {
    session?: { sub: string; exp: number; owner_id: string | null };
    profile?: { display_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
    profileStatus?: number;
  } = {}): ReturnType<typeof vi.fn> {
    const session = opts.session ?? { sub: "abc", exp: 0, owner_id: "owner-1" };
    const profileStatus = opts.profileStatus ?? 200;
    const profileBody = opts.profile === null ? null : (opts.profile ?? { display_name: null, email: "alice@example.com", avatar_url: null });
    return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input) => {
        const url = String(input);
        if (url.includes("/api/auth/session")) {
          return new Response(JSON.stringify(session), { status: 200 });
        }
        if (url.includes("/api/me")) {
          if (profileBody === null) {
            return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: profileStatus });
          }
          return new Response(JSON.stringify(profileBody), { status: profileStatus });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      },
    );
  }

  it("reads identity from the safe /api/auth/session endpoint", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithMantine(
      <QueryClientProvider client={new QueryClient()}>
        <Header />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    // Must use the safe session route, not the legacy daemon client.
    expect(calledUrl).toContain("/api/auth/session");
  });

  it("does not attach Cognito token material on the session fetch", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithMantine(
      <QueryClientProvider client={new QueryClient()}>
        <Header />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    // No Authorization / no cookie forwarding to a public session route.
    expect(headers.authorization).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
  });

  it("calls /api/me after /api/auth/session to fetch profile fields", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithMantine(
      <QueryClientProvider client={new QueryClient()}>
        <Header />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/api/auth/session"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/me"))).toBe(true);
  });
});
