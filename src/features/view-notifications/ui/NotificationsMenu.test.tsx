/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { renderWithMantine } from "@/test/render-with-mantine";
import { NotificationsMenu } from "@/features/view-notifications/ui/NotificationsMenu";

// fetch is called by useNotifications; return empty arrays so the panel
// renders without hitting the network.
beforeEach(() => {
  // E2E bypass keeps `getCoreClient()` from throwing because the test
  // environment does not set NEXT_PUBLIC_TASTILE_CORE_URL. The bypass
  // base URL is the loopback v1 daemon — but `fetch` is stubbed above
  // so no real HTTP request is ever issued.
  vi.stubEnv("NEXT_PUBLIC_E2E_BYPASS_AUTH", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationsMenu wiring", () => {
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  function mockBellRect() {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      const id = this.getAttribute("data-testid");
      if (id === "bell") {
        return {
          x: 500,
          y: 12,
          left: 500,
          top: 12,
          right: 524,
          bottom: 36,
          width: 24,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  }

  function Layout({ notificationsOpen }: { notificationsOpen: boolean }) {
    // Same wiring shape as src/app/dashboard/layout-client.tsx.
    // Use a stub button in place of FloatingHeader so the test is
    // independent of next/navigation + the float-header DOM tree.
    const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
    return (
      <>
        <button
          ref={notificationsButtonRef}
          data-testid="bell"
          type="button"
          aria-label="Open notifications"
        />
        <NotificationsMenu
          open={notificationsOpen}
          onOpenChange={() => {}}
          anchorRef={notificationsButtonRef}
        />
      </>
    );
  }

  it("anchors the panel under the bell when both header and menu share the same ref", () => {
    mockBellRect();
    renderWithMantine(<Layout notificationsOpen={true} />);

    const panel = document.querySelector(
      '[data-floating-menu-content]',
    ) as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("data-state")).toBe("open");
    // top = bell.bottom (36) + sideOffset (8) = 44
    expect(panel.style.top).toBe("44px");
  });
});
