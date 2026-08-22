import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it("returns the explicit query-lang value when it is supported", () => {
    expect(
      resolveLocale({ queryLang: "ja", cookieValue: "en", acceptLanguage: "ko" }),
    ).toBe("ja");
  });

  it("ignores an unsupported query-lang and falls back to the cookie", () => {
    expect(
      resolveLocale({ queryLang: "fr", cookieValue: "en", acceptLanguage: "ko" }),
    ).toBe("en");
  });

  it("uses the cookie when the query-lang is absent", () => {
    expect(
      resolveLocale({ cookieValue: "zh-CN", acceptLanguage: "ko" }),
    ).toBe("zh-CN");
  });

  it("ignores an unsupported cookie value", () => {
    expect(
      resolveLocale({ cookieValue: "klingon", acceptLanguage: "ja" }),
    ).toBe("ja");
  });

  it("falls back to Accept-Language when both query and cookie are missing", () => {
    expect(resolveLocale({ acceptLanguage: "es-MX,en;q=0.5" })).toBe("es");
  });

  it("returns the fallback locale when nothing matches", () => {
    expect(resolveLocale({})).toBe("en");
    expect(resolveLocale({ acceptLanguage: "fr;q=0.9,de;q=0.8" })).toBe("en");
  });

  it("treats query-lang priority strictly above the cookie", () => {
    expect(
      resolveLocale({ queryLang: "ko", cookieValue: "ja", acceptLanguage: "en" }),
    ).toBe("ko");
  });
});
