// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsDesktop, useMediaQuery } from "./use-media-query";

type ChangeListener = (this: MediaQueryList, ev: MediaQueryListEvent) => unknown;

interface MockHandle {
  stub: MediaQueryList;
  listeners: ChangeListener[];
}

function installMockMatchMedia(initial = false): MockHandle {
  const listeners: ChangeListener[] = [];
  const stub: MediaQueryList = {
    get matches() {
      return stubState.matches;
    },
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, cb: EventListener) => {
      listeners.push(cb as unknown as ChangeListener);
    },
    removeEventListener: (_type: string, cb: EventListener) => {
      const index = listeners.indexOf(cb as unknown as ChangeListener);
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent: () => false,
  };
  const stubState: { matches: boolean } = { matches: initial };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => stub,
  });

  return { stub, listeners };
}

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-testid="value">{String(matches)}</span>;
}

function DesktopProbe() {
  const isDesktop = useIsDesktop();
  return <span data-testid="value">{String(isDesktop)}</span>;
}

function fireChange(listeners: ChangeListener[], matches: boolean) {
  act(() => {
    for (const listener of listeners) {
      listener.call({} as MediaQueryList, { matches } as MediaQueryListEvent);
    }
  });
}

describe("useMediaQuery", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it("returns the initial value from matchMedia", () => {
    installMockMatchMedia(true);
    const { getByTestId } = render(<Probe query="(min-width: 1024px)" />);
    expect(getByTestId("value").textContent).toBe("true");
  });

  it("updates when the media listener fires", () => {
    const { listeners } = installMockMatchMedia(false);
    const { getByTestId } = render(<Probe query="(min-width: 1024px)" />);
    expect(getByTestId("value").textContent).toBe("false");
    expect(listeners.length).toBe(1);

    fireChange(listeners, true);
    expect(getByTestId("value").textContent).toBe("true");
  });

  it("unregisters its listener on unmount", () => {
    const { listeners } = installMockMatchMedia(false);
    const { unmount } = render(<Probe query="(min-width: 1024px)" />);
    expect(listeners.length).toBe(1);

    unmount();
    expect(listeners.length).toBe(0);
  });

  it("useIsDesktop follows the desktop breakpoint", () => {
    const { listeners } = installMockMatchMedia(false);
    const { getByTestId } = render(<DesktopProbe />);
    expect(getByTestId("value").textContent).toBe("false");

    fireChange(listeners, true);
    expect(getByTestId("value").textContent).toBe("true");
  });
});
