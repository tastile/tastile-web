/** @vitest-environment jsdom */
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { renderWithMantine } from "@/test/render-with-mantine";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuItem,
  FloatingMenuTrigger,
} from "@/components/ui/floating-menu";

describe("FloatingMenu external-trigger positioning", () => {
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  function mockRects(triggerRect: Partial<DOMRect>) {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.getAttribute("data-testid") === "anchor") {
        return {
          x: 100,
          y: 200,
          left: 100,
          top: 200,
          right: 132,
          bottom: 232,
          width: 32,
          height: 32,
          ...triggerRect,
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

  function Harness({ open }: { open: boolean }) {
    const triggerRef = useRef<HTMLElement | null>(null);
    return (
      <>
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          data-testid="anchor"
          type="button"
        >
          trigger
        </button>
        <FloatingMenu open={open} onOpenChange={() => {}} triggerRef={triggerRef}>
          <FloatingMenuContent align="end" sideOffset={8}>
            content
          </FloatingMenuContent>
        </FloatingMenu>
      </>
    );
  }

  it("positions the content at triggerRect.bottom + sideOffset when align=end, side=bottom", () => {
    mockRects({});
    renderWithMantine(<Harness open={true} />);

    const panel = document.querySelector(
      '[data-floating-menu-content]',
    ) as HTMLElement;
    expect(panel).toBeTruthy();
    // top = triggerRect.bottom (232) + scrollY (0 in jsdom) + sideOffset (8) = 240
    expect(panel.style.top).toBe("240px");
    // left = triggerRect.right (132) + scrollX (0) - contentRect.width (0 in jsdom) = 132
    expect(panel.style.left).toBe("132px");
    expect(panel.getAttribute("data-state")).toBe("open");
  });

  it("flips to top when content would overflow the viewport (side=bottom default)", () => {
    // jsdom viewport is 768. With content height = 0 (no real layout), the
    // overflow check reduces to `triggerRect.bottom + sideOffset > vh`.
    // bottom = 770 makes 770 + 8 > 768, flipping to "top".
    mockRects({ top: 730, bottom: 770, height: 40 });
    renderWithMantine(<Harness open={true} />);

    const panel = document.querySelector(
      '[data-floating-menu-content]',
    ) as HTMLElement;
    expect(panel).toBeTruthy();
    // Flipped: top = triggerRect.top + scrollY - sideOffset - contentRect.height
    expect(panel.getAttribute("data-side")).toBe("top");
  });

  it("does not render the panel when closed", () => {
    mockRects({});
    renderWithMantine(<Harness open={false} />);

    const panel = document.querySelector('[data-floating-menu-content]');
    expect(panel).toBeNull();
  });

  it("keeps data-state=closed (invisible) when triggerRef.current is null", () => {
    mockRects({});
    // open={true} but no anchorRef-capable element; default useRef stays empty.
    renderWithMantine(
      <FloatingMenu open={true} onOpenChange={() => {}}>
        <FloatingMenuContent align="end" sideOffset={8}>
          orphan
        </FloatingMenuContent>
      </FloatingMenu>,
    );

    const panel = document.querySelector(
      '[data-floating-menu-content]',
    ) as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("data-state")).toBe("closed");
  });
});

describe("FloatingMenu controlled/uncontrolled contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("controlled mode never mutates the visual state when onOpenChange rejects the change", () => {
    renderWithMantine(
      <FloatingMenu open={false} onOpenChange={() => {}}>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent>content</FloatingMenuContent>
      </FloatingMenu>,
    );

    expect(document.querySelector("[data-floating-menu-content]")).toBeNull();

    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);

    // Parent didn't flip open prop to true → panel stays closed.
    expect(document.querySelector("[data-floating-menu-content]")).toBeNull();
    expect(
      (document.querySelector("[data-floating-menu-trigger]") as HTMLElement).getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
  });

  it("uncontrolled mode honors defaultOpen and toggles internally", () => {
    renderWithMantine(
      <FloatingMenu defaultOpen>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent>content</FloatingMenuContent>
      </FloatingMenu>,
    );

    expect(document.querySelector("[data-floating-menu-content]")).toBeTruthy();

    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);

    expect(document.querySelector("[data-floating-menu-content]")).toBeNull();

    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);
    expect(document.querySelector("[data-floating-menu-content]")).toBeTruthy();
  });

  it("calls onOpenChange for every transition in both modes", () => {
    const onOpenChange = vi.fn();

    const { rerender } = renderWithMantine(
      <FloatingMenu onOpenChange={onOpenChange}>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent>content</FloatingMenuContent>
      </FloatingMenu>,
    );

    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);
    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);

    onOpenChange.mockClear();
    rerender(
      <FloatingMenu open={false} onOpenChange={onOpenChange}>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent>content</FloatingMenuContent>
      </FloatingMenu>,
    );
    fireEvent.click(document.querySelector("[data-floating-menu-trigger]") as HTMLElement);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("Escape closes the menu when open", () => {
    const onOpenChange = vi.fn();
    renderWithMantine(
      <FloatingMenu defaultOpen onOpenChange={onOpenChange}>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent>content</FloatingMenuContent>
      </FloatingMenu>,
    );

    expect(document.querySelector("[data-floating-menu-content]")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.querySelector("[data-floating-menu-content]")).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("renders portal content reachable from document.body", () => {
    const { baseElement } = renderWithMantine(
      <FloatingMenu defaultOpen>
        <FloatingMenuTrigger>
          <span>trigger</span>
        </FloatingMenuTrigger>
        <FloatingMenuContent data-testid="panel">content</FloatingMenuContent>
      </FloatingMenu>,
    );

    const panel = baseElement.querySelector('[data-testid="panel"]');
    expect(panel?.parentElement).toBe(document.body);
  });

  it("wires external triggerRef to floating menu trigger element", () => {
    function ExternalTriggerHarness() {
      const ref = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button ref={ref} data-testid="external-anchor" type="button">
            external
          </button>
          <FloatingMenu triggerRef={ref}>
            <FloatingMenuContent>content</FloatingMenuContent>
          </FloatingMenu>
        </>
      );
    }

    const { baseElement } = renderWithMantine(<ExternalTriggerHarness />);
    expect(baseElement.querySelector('[data-testid="external-anchor"]')).toBeTruthy();
  });
});
