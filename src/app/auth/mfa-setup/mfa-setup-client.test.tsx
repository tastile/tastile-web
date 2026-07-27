/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";

const { mockReplace } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

// Stub the locale store so the test does not need a Zustand persist boundary.
vi.mock("@/lib/stores/locale-store", () => ({
  useLocaleStore: vi.fn(() => ({ locale: "en", setLocale: vi.fn() })),
}));

const setupCalls: Array<{ url: string; init?: RequestInit }> = [];
const verifyCalls: Array<{ url: string; init?: RequestInit }> = [];

type FetchHandler = (url: string, init?: RequestInit) => Response;

function installFetch(handler: FetchHandler) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = typeof url === "string" ? url : url.toString();
      if (target.endsWith("/api/account/mfa/setup")) {
        setupCalls.push({ url: target, init });
      } else if (target.endsWith("/api/account/mfa/verify")) {
        verifyCalls.push({ url: target, init });
      }
      return handler(target, init);
    }),
  );
}

function okSetup(secret = "BASE32SECRET"): Response {
  return new Response(
    JSON.stringify({
      secretCode: secret,
      otpauthUrl: `otpauth://totp/Tastile:user?secret=${secret}&issuer=Tastile`,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  setupCalls.length = 0;
  verifyCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderClient(email = "user@example.com") {
  const { MfaSetupClient } = await import("./mfa-setup-client");
  renderWithMantine(<MfaSetupClient email={email} />);
}

describe("MfaSetupClient", () => {
  it("POSTs once to /api/account/mfa/setup and shows secret + otpauth URL", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup("BASE32SECRET");
      return new Response("{}", { status: 404 });
    });

    await renderClient();

    await waitFor(() => {
      expect(setupCalls).toHaveLength(1);
    });
    expect(setupCalls[0].init?.method).toBe("POST");
    expect(setupCalls[0].url).toContain("/api/account/mfa/setup");
    expect(screen.getByTestId("secret").textContent).toContain("BASE32SECRET");
    expect(
      screen.getByText(/otpauth:\/\/totp\/Tastile/),
    ).toBeTruthy();
  });

  it("displays the server-provided error message on setup failure", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) {
        return new Response(JSON.stringify({ error: "no_cognito" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();

    await waitFor(() => {
      expect(screen.getByText(/no_cognito/)).toBeTruthy();
    });
    expect(
      screen.getByRole("button", { name: /retry sign-in/i }),
    ).toBeTruthy();
    // No retry POST is fired — just the mount POST, which already failed.
    expect(setupCalls).toHaveLength(1);
  });

  it("treats a network failure as an error-state branch, not an explicit throw", async () => {
    // Simulates fetch itself rejecting (e.g. offline). The catch handler must
    // still set the error state rather than letting the rejection bubble.
    installFetch(() => {
      throw new TypeError("network_down");
    });

    await renderClient();

    await waitFor(() => {
      expect(screen.getByText(/network_down/)).toBeTruthy();
    });
  });

  it("disables the verify button until the input matches six digits", async () => {
    installFetch((url) => (url.endsWith("/api/account/mfa/setup") ? okSetup() : new Response("{}", { status: 404 })));

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    const button = screen.getByRole("button", { name: "Verify" }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "12" } });
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    // 6-digit boundary rejects the short code — no verify POST.
    expect(verifyCalls).toHaveLength(0);
  });

  it("filters non-numeric input to six digits and POSTs verify on success", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        expect(url).toContain("/api/account/mfa/verify");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    // Letters must be stripped — the input only retains digits and caps at 6.
    fireEvent.change(input, { target: { value: "abc1234567890" } });
    expect(input.value).toBe("123456");

    const button = screen.getByRole("button", { name: "Verify" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
    expect(verifyCalls).toHaveLength(1);
  });

  // Regression I-1: setup returns 200 with malformed JSON must land in the
  // existing setup_failed error state, not throw an unhandled rejection.
  it("falls back to setup_failed when setup returns 200 with malformed JSON", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) {
        return new Response("definitely not json {", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    // Track unhandled rejections so we know the test itself didn't swallow
    // a thrown promise that should have been an error-state branch.
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    try {
      await renderClient();
      await waitFor(() => {
        expect(screen.getByText(/setup_failed/)).toBeTruthy();
      });
      expect(
        screen.getByRole("button", { name: /retry sign-in/i }),
      ).toBeTruthy();
      // No unhandled rejection — the body parse failure landed in state.
      expect(unhandled).toHaveLength(0);
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });

  it("falls back to setup_failed when setup returns 200 with an error-shaped JSON", async () => {
    // 200 + body without secretCode/otpauthUrl is not a usable setup payload.
    // The component must surface the stable setup_failed fallback rather
    // than render undefined.
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) {
        return new Response(JSON.stringify({ error: "already_set_up" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => {
      expect(screen.getByText(/setup_failed/)).toBeTruthy();
    });
    expect(screen.queryByTestId("secret")).toBeNull();
  });

  it("falls back to setup_failed when setup returns 500 with malformed JSON", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) {
        return new Response("not json at all", {
          status: 500,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => {
      expect(screen.getByText(/setup_failed/)).toBeTruthy();
    });
  });

  // Regression I-2: verify returns 200 with `{ok:false,error:'expired_session'}`
  // must surface that error code on the first read (the body cannot be
  // consumed twice), with a verify_failed fallback when the body is missing
  // or unparseable.
  it("shows expired_session error when verify returns 200 with {ok:false,error:'expired_session'}", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        return new Response(
          JSON.stringify({ ok: false, error: "expired_session" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText(/expired_session/)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(verifyCalls).toHaveLength(1);
  });

  it("falls back to verify_failed when verify returns 200 with malformed JSON", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        return new Response("garbage body", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText(/verify_failed/)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to verify_failed when verify returns 200 with {ok:false} (no error field)", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        return new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText(/verify_failed/)).toBeTruthy();
    });
  });

  it("preserves the translated 401 message when verify returns 401 with valid JSON", async () => {
    // 401 is the only verify response where we translate; everything else
    // surfaces the raw error code.
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        return new Response(
          JSON.stringify({ error: "code_mismatch", message: "CodeMismatch" }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect|invalid|mismatch/i)).toBeTruthy();
    });
    // Raw error code must NOT leak in this branch.
    expect(screen.queryByText(/code_mismatch/)).toBeNull();
  });

  it("falls back to verify_failed when verify returns 500 with malformed JSON", async () => {
    installFetch((url) => {
      if (url.endsWith("/api/account/mfa/setup")) return okSetup();
      if (url.endsWith("/api/account/mfa/verify")) {
        return new Response("not json at all", {
          status: 500,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    await renderClient();
    await waitFor(() => expect(screen.getByTestId("secret")).toBeTruthy());

    const input = screen.getByLabelText("6-digit code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText(/verify_failed/)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
