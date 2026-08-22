/** @vitest-environment jsdom */

import { within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `let` so each test can rewrite the Accept-Language / cookie value before
// invoking the page; `next/headers` is mocked via `vi.mock` so the mock
// is wired up before the `page.tsx` module is dynamically imported below.
let mockAcceptLanguage: string | null = null;
let mockCookieValue: string | undefined;

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) =>
      name.toLowerCase() === "accept-language" ? mockAcceptLanguage : null,
  })),
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "NEXT_LOCALE" ? { value: mockCookieValue ?? "" } : undefined),
  })),
}));

const { default: Home } = await import("./page");
const { renderWithMantine } = await import("@/test/render-with-mantine");

async function renderHome(searchParams: Record<string, string> = {}) {
  const ui = await Home({ searchParams: Promise.resolve(searchParams) });
  return renderWithMantine(ui);
}

afterEach(() => {
  mockAcceptLanguage = null;
  mockCookieValue = undefined;
});

describe("Home landing locale resolution", () => {
  it("uses the explicit ?lang= override ahead of Accept-Language", async () => {
    mockAcceptLanguage = "ja-JP,en;q=0.5";
    const { baseElement } = await renderHome({ lang: "en" });
    const scoped = within(baseElement);
    // English header copy: "Pricing".
    expect(scoped.getAllByText("Pricing").length).toBeGreaterThan(0);
    // No Japanese copy should leak through.
    expect(scoped.queryAllByText("料金")).toHaveLength(0);
  });

  it("falls back to Accept-Language when ?lang= is missing", async () => {
    mockAcceptLanguage = "ja-JP,en;q=0.5";
    const { baseElement } = await renderHome();
    const scoped = within(baseElement);
    // Japanese header copy: "料金".
    expect(scoped.getAllByText("料金").length).toBeGreaterThan(0);
    expect(scoped.queryAllByText("Pricing")).toHaveLength(0);
  });

  it("falls back to Accept-Language when ?lang= is unsupported", async () => {
    mockAcceptLanguage = "ja";
    const { baseElement } = await renderHome({ lang: "fr" });
    expect(within(baseElement).getAllByText("料金").length).toBeGreaterThan(0);
  });

  it("falls back to English when neither ?lang= nor Accept-Language resolves", async () => {
    const { baseElement } = await renderHome();
    const scoped = within(baseElement);
    expect(scoped.getAllByText("Pricing").length).toBeGreaterThan(0);
    expect(scoped.queryAllByText("料金")).toHaveLength(0);
  });

  it("falls back to English when Accept-Language carries no supported tag", async () => {
    mockAcceptLanguage = "fr;q=0.9,de;q=0.8";
    const { baseElement } = await renderHome();
    expect(within(baseElement).getAllByText("Pricing").length).toBeGreaterThan(0);
  });

  it("respects Accept-Language q-value ordering", async () => {
    mockAcceptLanguage = "en;q=0.2,ko;q=0.9";
    const { baseElement } = await renderHome();
    // Korean header copy: "요금제".
    expect(within(baseElement).getAllByText("요금제").length).toBeGreaterThan(0);
  });

  it("maps Chinese Accept-Language to zh-CN", async () => {
    mockAcceptLanguage = "zh-CN,en;q=0.5";
    const { baseElement } = await renderHome();
    // Simplified Chinese header copy: "价格".
    expect(within(baseElement).getAllByText("价格").length).toBeGreaterThan(0);
  });

  it("falls back to English for Traditional Chinese Accept-Language", async () => {
    mockAcceptLanguage = "zh-TW";
    const { baseElement } = await renderHome();
    expect(within(baseElement).getAllByText("Pricing").length).toBeGreaterThan(0);
  });

  it("uses the NEXT_LOCALE cookie ahead of Accept-Language", async () => {
    mockCookieValue = "ko";
    mockAcceptLanguage = "ja-JP,en;q=0.5";
    const { baseElement } = await renderHome();
    expect(within(baseElement).getAllByText("요금제").length).toBeGreaterThan(0);
    expect(within(baseElement).queryAllByText("料金")).toHaveLength(0);
  });

  it("keeps ?lang= ahead of the NEXT_LOCALE cookie", async () => {
    mockCookieValue = "ko";
    mockAcceptLanguage = "ja";
    const { baseElement } = await renderHome({ lang: "en" });
    expect(within(baseElement).getAllByText("Pricing").length).toBeGreaterThan(0);
    expect(within(baseElement).queryAllByText("요금제")).toHaveLength(0);
  });

  it("ignores an unsupported NEXT_LOCALE cookie and falls back to Accept-Language", async () => {
    mockCookieValue = "klingon";
    mockAcceptLanguage = "ja";
    const { baseElement } = await renderHome();
    expect(within(baseElement).getAllByText("料金").length).toBeGreaterThan(0);
  });

  it("renders the footer locale switcher with every supported locale", async () => {
    const { baseElement } = await renderHome();
    // The switcher is a `<nav aria-label="Language">` whose list links carry
    // the native-script names.
    const nav = within(baseElement).getByRole("navigation", { name: "Language" });
    const scoped = within(nav);
    for (const label of ["日本語", "English", "中文", "한국어", "Español"]) {
      expect(scoped.getByRole("link", { name: label })).toBeTruthy();
    }
  });
});
