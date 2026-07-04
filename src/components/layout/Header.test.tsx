/** @vitest-environment jsdom */

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

vi.mock("@/components/execution/ActiveExecutionBar", () => ({
  ActiveExecutionBar: () => null,
}));

vi.mock("@/app/app/account-menu", () => ({
  AccountMenu: () => null,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Header identity fetch", () => {
  function buildFetchMock(): ReturnType<typeof vi.fn> {
    return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ sub: "abc", exp: 0, owner_id: "owner-1" }), { status: 200 }),
    );
  }

  it("reads identity from the safe /api/auth/session endpoint", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Header />);
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

    render(<Header />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    // No Authorization / no cookie forwarding to a public session route.
    expect(headers.authorization).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
  });
});
