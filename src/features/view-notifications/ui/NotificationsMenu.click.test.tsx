/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { useRef } from "react";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/hooks/use-notifications")>();
  return {
    ...actual,
    useNotifications: () => ({
      notifications: [
        {
          id: "prompt:abc-123",
          message: "Pending prompt: pick a slot",
          timestamp: new Date("2026-07-28T00:00:00Z"),
          readAt: null,
          source: "execution",
        },
      ],
      unreadCount: 1,
      loading: false,
      error: null,
      refresh: () => {},
    }),
  };
});

import { NotificationsMenu } from "@/features/view-notifications/ui/NotificationsMenu";

function Layout() {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={anchorRef}
        data-testid="bell"
        type="button"
        aria-label="Open notifications"
      />
      <NotificationsMenu
        open={true}
        onOpenChange={() => {}}
        anchorRef={anchorRef}
      />
    </>
  );
}

describe("NotificationsMenu click navigation", () => {
  beforeEach(() => {
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
  });

  it("navigates to /app/prompt?focus=<id> when an execution prompt notification is clicked", () => {
    const assignSpy = vi.fn();
    const stubLocation = { ...window.location, assign: assignSpy };
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      get: () => stubLocation,
      set: () => {},
    });

    try {
      renderWithMantine(<Layout />);
      const button = screen.getByTestId("notification-prompt:abc-123");
      fireEvent.click(button);
      expect(assignSpy).toHaveBeenCalledWith("/app/prompt?focus=abc-123");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, "location", originalDescriptor);
      }
    }
  });
});
