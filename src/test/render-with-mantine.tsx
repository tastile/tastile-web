/** @vitest-environment jsdom */
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { cssVariablesResolver } from "@/lib/theme/css-variables-resolver";
import { mantineTheme } from "@/lib/theme/mantine-theme";

// jsdom does not implement window.matchMedia. Mantine's MantineProvider calls
// it inside its color-scheme effect, so without this polyfill the first render
// throws `TypeError: window.matchMedia is not a function`.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement ResizeObserver. Mantine's SegmentedControl uses it
// for its floating indicator, so without this polyfill the component throws on
// mount.
if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  const ResizeObserverMock = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverMock;
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverMock;
}

/**
 * Wraps `render()` so every component under test resolves Mantine's theme +
 * CSS variables without forcing each test file to repeat the provider tree.
 *
 * `MantineProvider` is required for any Mantine component to mount — without
 * it, the first render throws "@mantine/core: MantineProvider was not found".
 */
export function renderWithMantine(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider
        theme={mantineTheme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="auto"
      >
        <DatesProvider settings={{ locale: "en", firstDayOfWeek: 0 }}>{children}</DatesProvider>
      </MantineProvider>
    ),
    ...options,
  });
}
