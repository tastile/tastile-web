// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsDesktop, useMediaQuery } from "./use-media-query";

type MediaListener = (event: MediaQueryListEvent) => void;

interface MockHandle {
  stub: MediaQueryList;
  listeners: MediaListener[];
}

function installMockMatchMedia(initial = false): MockHandle {
  const listeners: MediaListener[] = [];
  const stub: MediaQueryList = {
    matches: initial,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, cb: MediaListener) => {
      listeners.push(cb);
    },
    removeEventListener: (_type: string, cb: MediaListener) => {
      const index = listeners.indexOf(cb);
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent: () => false,
  };

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

function fireChange(listeners: MediaListener[], matches: boolean) {
  act(() => {
    for (const listener of listeners) {
      listener({ matches } as MediaQueryListEvent);
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
    const { stub } = installMockMatchMedia(true);
    stub.matches = true;
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
