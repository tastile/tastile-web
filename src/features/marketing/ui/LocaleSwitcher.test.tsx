/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathnameMock = vi.fn<(options?: { readonly?: boolean }) => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    "aria-current": ariaCurrent,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    "aria-current"?: "true" | "false" | "page" | "step" | "location" | "date" | "time" | boolean;
  }) => (
    <a
      href={href}
      aria-current={ariaCurrent as React.AriaAttributes["aria-current"]}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const { LocaleSwitcher } = await import("./LocaleSwitcher");
const { LOCALE_COOKIE, localeCookieAttributes } = await import(
  "@/shared/i18n/locale-cookie"
);

afterEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
  pathnameMock.mockReset();
});

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    // Default to a stable pathname; individual tests override.
    pathnameMock.mockReturnValue("/");
  });

  it("renders every supported locale as a native-script link", () => {
    render(<LocaleSwitcher currentLocale="en" label="Language" />);
    expect(screen.getByRole("link", { name: "日本語" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "English" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "中文" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "한국어" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Español" })).toBeTruthy();
  });

  it("marks the current locale with aria-current=true", () => {
    render(<LocaleSwitcher currentLocale="ja" label="言語" />);
    expect(
      screen.getByRole("link", { name: "日本語" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("builds hrefs from the current pathname + ?lang=<locale>", () => {
    pathnameMock.mockReturnValue("/pricing");
    render(<LocaleSwitcher currentLocale="en" label="Language" />);
    expect(
      screen.getByRole("link", { name: "日本語" }).getAttribute("href"),
    ).toBe("/pricing?lang=ja");
  });

  it("encodes zh-CN correctly in the href", () => {
    pathnameMock.mockReturnValue("/");
    render(<LocaleSwitcher currentLocale="en" label="Language" />);
    expect(
      screen.getByRole("link", { name: "中文" }).getAttribute("href"),
    ).toBe("/?lang=zh-CN");
  });

  it("sets the NEXT_LOCALE cookie on click", async () => {
    const user = userEvent.setup();
    pathnameMock.mockReturnValue("/");
    render(<LocaleSwitcher currentLocale="en" label="Language" />);

    await user.click(screen.getByRole("link", { name: "Español" }));

    // `document.cookie` exposes only the key=value pair; the path/max-age
    // attributes are kept by the browser internally. We assert the visible
    // pair and the attribute string sent to the setter.
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=es`);
    const attrs = localeCookieAttributes();
    expect(attrs).toContain("path=/");
    expect(attrs).toContain("SameSite=Lax");
    expect(attrs).toContain("max-age=");
  });

  it("renders the localized eyebrow label", () => {
    render(<LocaleSwitcher currentLocale="ja" label="言語" />);
    expect(screen.getByText("言語")).toBeTruthy();
  });

  it("labels the nav with the same string as the eyebrow", () => {
    render(<LocaleSwitcher currentLocale="ja" label="言語" />);
    expect(screen.getByRole("navigation", { name: "言語" })).toBeTruthy();
  });
});
