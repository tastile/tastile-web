/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { DirectDaemonToggle } from "./DirectDaemonToggle";

const fetchMock = vi.fn();

function setDocumentCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    configurable: true,
    value,
  });
}

function jsonResponse(status: number, body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setDocumentCookie("");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function getSwitch(): HTMLInputElement {
  return screen.getByRole("switch") as HTMLInputElement;
}

describe("DirectDaemonToggle", () => {
  it("renders the switch unchecked when the cookie is absent", () => {
    renderWithMantine(<DirectDaemonToggle />);

    expect(getSwitch().checked).toBe(false);
  });

  it("renders the switch checked when the cookie is already set", () => {
    setDocumentCookie("tastile_direct_daemon=1");

    renderWithMantine(<DirectDaemonToggle />);

    expect(getSwitch().checked).toBe(true);
  });

  it("POSTs /api/account/direct-mode when flipped on and shows saved indicator", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200));

    renderWithMantine(<DirectDaemonToggle />);

    fireEvent.click(screen.getByTestId("direct-mode-switch"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/account/direct-mode");
    expect(init.method).toBe("POST");

    await waitFor(() => {
      expect(screen.getByTestId("direct-mode-saved")).toBeTruthy();
    });
  });

  it("DELETEs /api/account/direct-mode when flipped off", async () => {
    setDocumentCookie("tastile_direct_daemon=1");
    fetchMock.mockResolvedValueOnce(jsonResponse(200));

    renderWithMantine(<DirectDaemonToggle />);

    fireEvent.click(screen.getByTestId("direct-mode-switch"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/account/direct-mode");
    expect(init.method).toBe("DELETE");
  });

  it("shows an error indicator when the server returns a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "not authenticated" }));

    renderWithMantine(<DirectDaemonToggle />);

    fireEvent.click(getSwitch());

    await waitFor(() => {
      expect(screen.getByTestId("direct-mode-error")).toBeTruthy();
    });
    // State must not flip to enabled when the server rejects the request.
    expect(getSwitch().checked).toBe(false);
  });
});