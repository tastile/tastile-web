import { describe, expect, it } from "vitest";
import {
  _internalsForTest,
  negotiateAcceptLanguage,
} from "./accept-language";

const { parseAcceptLanguage, mapTagToLocale } = _internalsForTest;

describe("parseAcceptLanguage", () => {
  it("returns an empty list for missing or empty headers", () => {
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage("   ")).toEqual([]);
  });

  it("parses a single tag with the default q of 1", () => {
    expect(parseAcceptLanguage("ja")).toEqual([{ tag: "ja", q: 1 }]);
  });

  it("lower-cases tags and trims whitespace", () => {
    expect(parseAcceptLanguage("  EN-US ; q=0.8 ")).toEqual([
      { tag: "en-us", q: 0.8 },
    ]);
  });

  it("sorts higher-quality tags first", () => {
    expect(parseAcceptLanguage("en;q=0.5,ja")).toEqual([
      { tag: "ja", q: 1 },
      { tag: "en", q: 0.5 },
    ]);
  });

  it("ignores malformed q values and falls back to q=1", () => {
    expect(parseAcceptLanguage("ja;q=abc")).toEqual([{ tag: "ja", q: 1 }]);
    expect(parseAcceptLanguage("ja;q=2")).toEqual([{ tag: "ja", q: 1 }]);
  });

  it("treats q=0 as supported-but-zero quality (still parsed)", () => {
    expect(parseAcceptLanguage("fr;q=0,ja;q=0.5")).toEqual([
      { tag: "ja", q: 0.5 },
      { tag: "fr", q: 0 },
    ]);
  });

  it("skips wildcards and empty entries", () => {
    expect(parseAcceptLanguage("*,ja,,")).toEqual([{ tag: "ja", q: 1 }]);
  });
});

describe("mapTagToLocale", () => {
  it("maps exact supported locales to themselves", () => {
    expect(mapTagToLocale("en")).toBe("en");
    expect(mapTagToLocale("ja")).toBe("ja");
    expect(mapTagToLocale("zh-cn")).toBe("zh-CN");
    expect(mapTagToLocale("ko")).toBe("ko");
    expect(mapTagToLocale("es")).toBe("es");
  });

  it("maps Chinese subtag variants to zh-CN", () => {
    expect(mapTagToLocale("zh")).toBe("zh-CN");
    expect(mapTagToLocale("zh-hans")).toBe("zh-CN");
    expect(mapTagToLocale("zh-hans-cn")).toBe("zh-CN");
  });

  it("does NOT map Traditional Chinese variants", () => {
    expect(mapTagToLocale("zh-tw")).toBeNull();
    expect(mapTagToLocale("zh-hk")).toBeNull();
    expect(mapTagToLocale("zh-hant")).toBeNull();
    expect(mapTagToLocale("zh-hant-tw")).toBeNull();
  });

  it("falls back to the language subtag when region is unsupported", () => {
    expect(mapTagToLocale("ja-jp")).toBe("ja");
    expect(mapTagToLocale("ko-kr")).toBe("ko");
    expect(mapTagToLocale("es-mx")).toBe("es");
    expect(mapTagToLocale("en-gb")).toBe("en");
  });

  it("returns null for languages we don't carry", () => {
    expect(mapTagToLocale("fr")).toBeNull();
    expect(mapTagToLocale("de")).toBeNull();
    expect(mapTagToLocale("pt-br")).toBeNull();
  });
});

describe("negotiateAcceptLanguage", () => {
  it("returns null for missing headers", () => {
    expect(negotiateAcceptLanguage(undefined)).toBeNull();
    expect(negotiateAcceptLanguage(null)).toBeNull();
    expect(negotiateAcceptLanguage("")).toBeNull();
  });

  it("returns the single supported tag", () => {
    expect(negotiateAcceptLanguage("ja")).toBe("ja");
  });

  it("respects explicit q ordering", () => {
    expect(negotiateAcceptLanguage("en;q=0.2,ja;q=0.9")).toBe("ja");
  });

  it("skips over unsupported tags to find a supported one", () => {
    expect(negotiateAcceptLanguage("fr,de,ja")).toBe("ja");
  });

  it("returns null when no supported tag is present", () => {
    expect(negotiateAcceptLanguage("fr;q=0.9,de;q=0.8")).toBeNull();
  });

  it("handles region-tagged language subtags", () => {
    expect(negotiateAcceptLanguage("ja-JP,en-US;q=0.5")).toBe("ja");
    expect(negotiateAcceptLanguage("ko-KR")).toBe("ko");
    expect(negotiateAcceptLanguage("zh-Hans")).toBe("zh-CN");
  });

  it("ignores q=0 entries even if listed first", () => {
    expect(negotiateAcceptLanguage("ja;q=0,en")).toBe("en");
  });

  it("is case-insensitive", () => {
    expect(negotiateAcceptLanguage("JA-JP")).toBe("ja");
    expect(negotiateAcceptLanguage("ZH-Hans-CN")).toBe("zh-CN");
  });
});
