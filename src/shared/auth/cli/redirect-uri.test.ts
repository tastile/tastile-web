import { describe, expect, it } from "vitest";

import { validateLoopbackRedirect } from "./redirect-uri";

describe("validateLoopbackRedirect", () => {
  it("accepts a well-formed loopback callback URL", () => {
    expect(validateLoopbackRedirect("http://127.0.0.1:1234/callback")).toEqual({
      ok: true,
    });
  });

  it("accepts a high-numbered loopback port", () => {
    expect(validateLoopbackRedirect("http://127.0.0.1:65535/callback")).toEqual({
      ok: true,
    });
  });

  it("rejects https scheme", () => {
    const result = validateLoopbackRedirect("https://127.0.0.1:1234/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("scheme_must_be_http");
  });

  it("rejects attacker.example host", () => {
    const result = validateLoopbackRedirect("http://example.com/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("host_must_be_loopback");
  });

  it("rejects suffix-confusion host (127.0.0.1.attacker.example)", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1.attacker.example/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("host_must_be_loopback");
  });

  it("rejects a non-callback path", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:1234/not-callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("path_must_be_callback");
  });

  it("rejects an appended query string", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:1234/callback?foo=bar");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("query_not_allowed");
  });

  it("rejects a fragment", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:1234/callback#frag");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("fragment_not_allowed");
  });

  it("rejects embedded credentials", () => {
    const result = validateLoopbackRedirect(
      "http://user:pass@127.0.0.1:1234/callback",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credentials_not_allowed");
  });

  it("rejects unparseable input", () => {
    const result = validateLoopbackRedirect("not a url");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unparseable");
  });

  it("rejects a zero port", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:0/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("port_out_of_range");
  });

  it("rejects an over-range port", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:70000/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("port_out_of_range");
  });

  it("rejects a non-integer port", () => {
    const result = validateLoopbackRedirect("http://127.0.0.1:abc/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("port_out_of_range");
  });
});
