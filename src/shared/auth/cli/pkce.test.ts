import { describe, expect, it } from "vitest";

import {
  base64urlNoPad,
  generateGrantCode,
  hashGrantCode,
  s256,
  verifyS256,
} from "./pkce";

describe("s256 / verifyS256", () => {
  // RFC 7636 Appendix B test vector.
  // verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  // expected  = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
  it("matches the RFC 7636 Appendix B vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(s256(verifier)).toBe(expected);
    expect(verifyS256(expected, verifier)).toBe(true);
  });

  it("rejects a tampered verifier", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = s256(verifier);
    const tampered = `${verifier}X`;
    expect(verifyS256(expected, tampered)).toBe(false);
  });

  it("rejects an empty verifier", () => {
    expect(verifyS256(s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "")).toBe(false);
  });

  it("returns false on length mismatch without throwing", () => {
    expect(verifyS256("short", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(false);
  });
});

describe("base64urlNoPad", () => {
  it("strips padding, swaps + and /", () => {
    const buf = Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]);
    expect(base64urlNoPad(buf)).not.toContain("=");
    expect(base64urlNoPad(buf)).not.toContain("+");
    expect(base64urlNoPad(buf)).not.toContain("/");
  });
});

describe("generateGrantCode / hashGrantCode", () => {
  it("produces a 43-char base64url-no-pad string", () => {
    const code = generateGrantCode();
    expect(code).toHaveLength(43);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it("hashes deterministically to 64 hex chars", () => {
    const code = generateGrantCode();
    const hash = hashGrantCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hashGrantCode(code)).toBe(hash);
  });

  it("produces distinct hashes for distinct codes", () => {
    const a = hashGrantCode(generateGrantCode());
    const b = hashGrantCode(generateGrantCode());
    expect(a).not.toBe(b);
  });
});
