import { cssVariablesResolver } from "@/lib/theme/css-variables-resolver";
import { mantineTheme } from "@/lib/theme/mantine-theme";
/** @vitest-environment jsdom */
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";

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

// jsdom does not implement `document.fonts`. Mantine's `Textarea` Autosize
// uses `document.fonts.addEventListener("loadingdone", ...)` to re-measure on
// font load, so without this polyfill any `<Textarea autosize>` throws as
// soon as the `useEffect` runs.
if (typeof document !== "undefined" && !("fonts" in document)) {
  const fontsFacade = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    check: () => false,
    load: () => Promise.resolve([]),
    // `ready` resolves immediately because there are no real font loads
    // to wait for in jsdom. The type is intentionally loose because the
    // DOM `FontFaceSet` interface has many properties the test polyfill
    // does not implement.
    ready: Promise.resolve({} as unknown as FontFaceSet),
    status: "loaded",
  } as unknown as FontFaceSet;
  Object.defineProperty(document, "fonts", {
    configurable: true,
    writable: true,
    value: fontsFacade,
  });
}

/**
 * Wraps `render()` so every component under test resolves Mantine's theme +
 * CSS variables without forcing each test file to repeat the provider tree.
 *
 * `MantineProvider` is required for any Mantine component to mount — without
 * it, the first render throws "@mantine/core: MantineProvider was not found".
 *
 * `env="test"` opts Mantine into the synchronous-rendering path that skips
 * transition wiring (see `node_modules/@mantine/core/.../Transition/Transition.mjs`).
 * Without it, the first render of any Modal/Drawer renders its root
 * container but leaves the body content unmounted, because the underlying
 * `useTransition` hook never reports an "entered" state in jsdom (no
 * animation frames run).
 */
export function renderWithMantine(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider
        theme={mantineTheme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="auto"
        env="test"
      >
        <DatesProvider settings={{ locale: "en", firstDayOfWeek: 0 }}>{children}</DatesProvider>
      </MantineProvider>
    ),
    ...options,
  });
}
