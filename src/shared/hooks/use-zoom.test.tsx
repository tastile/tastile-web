// @vitest-environment jsdom
import { act, render, fireEvent } from "@testing-library/react";
import { useZoom } from "./use-zoom";

function TestComponent({
  initial = 56,
  min = 32,
  max = 192,
  step = 8,
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
} = {}) {
  const { ref, zoom } = useZoom<HTMLDivElement>({ initial, min, max, step });
  return (
    <div data-testid="scroll-parent" style={{ overflowY: "auto", height: 400 }}>
      <div ref={ref} data-testid="grid" style={{ height: 24 * zoom }}>
        <div data-testid="zoom-value">{zoom}</div>
        <div style={{ height: 1000 }} />
      </div>
    </div>
  );
}

// The hook commits wheel/trackpad events via requestAnimationFrame so
// that a burst of ticks in the same frame collapses into a single
// setZoom. Tests need to flush the rAF + the React commit before
// reading `zoom-value`.
async function flushZoomCommit() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe("useZoom", () => {
  describe("Ctrl+wheel zoom", () => {
    it("zooms out on ctrl+wheel down", async () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("48");
    });

    it("zooms in on ctrl+wheel up", async () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: -100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("64");
    });

    it("responds to metaKey (Cmd on macOS)", async () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { metaKey: true, deltaY: -100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("64");
    });

    it("coalesces multiple ticks in the same frame into one commit", async () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid");

      // Two ticks (-8, -8 = -16 from 56 → 40) dispatched before rAF
      // flushes. The hook should accumulate them and commit once.
      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("40");
    });
  });

  describe("Regular wheel does NOT zoom", () => {
    it("ignores wheel without ctrl/meta key", async () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { deltaY: 100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("56");
    });
  });

  describe("Zoom respects min/max bounds", () => {
    it("does not go below min", async () => {
      const { getByTestId } = render(<TestComponent initial={32} min={32} max={192} step={8} />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("32");
    });

    it("does not go above max", async () => {
      const { getByTestId } = render(<TestComponent initial={192} min={32} max={192} step={8} />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: -100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("192");
    });

    it("clamps at min after multiple zoom-outs", async () => {
      const { getByTestId } = render(<TestComponent initial={40} min={32} max={192} step={8} />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      await flushZoomCommit();
      fireEvent.wheel(grid, { ctrlKey: true, deltaY: 100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("32");
    });

    it("clamps at max after multiple zoom-ins", async () => {
      const { getByTestId } = render(<TestComponent initial={184} min={32} max={192} step={8} />);
      const grid = getByTestId("grid");

      fireEvent.wheel(grid, { ctrlKey: true, deltaY: -100 });
      await flushZoomCommit();
      fireEvent.wheel(grid, { ctrlKey: true, deltaY: -100 });
      await flushZoomCommit();
      expect(getByTestId("zoom-value").textContent).toBe("192");
    });
  });

  describe("Touch pinch zoom", () => {
    // Pinch is committed on touchend (not on each touchmove), so each
    // test must fire touchend before reading `zoom-value`.
    function firePinch(getGrid: () => HTMLElement, touches: Array<{ clientX: number; clientY: number; identifier: number }>) {
      fireEvent.touchStart(getGrid(), {
        touches: touches as unknown as Touch[],
        targetTouches: touches as unknown as Touch[],
        changedTouches: touches as unknown as Touch[],
      });
      fireEvent.touchMove(getGrid(), {
        touches: touches as unknown as Touch[],
        targetTouches: touches as unknown as Touch[],
        changedTouches: touches as unknown as Touch[],
      });
      fireEvent.touchEnd(getGrid(), {
        touches: [],
        targetTouches: [],
        changedTouches: [],
      });
    }

    it("zooms in when fingers move apart", () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid") as HTMLElement;

      fireEvent.touchStart(grid, {
        touches: [
          { clientX: 100, clientY: 100, identifier: 0 } as Touch,
          { clientX: 200, clientY: 200, identifier: 1 } as Touch,
        ],
        targetTouches: [
          { clientX: 100, clientY: 100, identifier: 0 } as Touch,
          { clientX: 200, clientY: 200, identifier: 1 } as Touch,
        ],
        changedTouches: [
          { clientX: 100, clientY: 100, identifier: 0 } as Touch,
          { clientX: 200, clientY: 200, identifier: 1 } as Touch,
        ],
      });

      fireEvent.touchMove(grid, {
        touches: [
          { clientX: 80, clientY: 80, identifier: 0 } as Touch,
          { clientX: 220, clientY: 220, identifier: 1 } as Touch,
        ],
        targetTouches: [
          { clientX: 80, clientY: 80, identifier: 0 } as Touch,
          { clientX: 220, clientY: 220, identifier: 1 } as Touch,
        ],
        changedTouches: [
          { clientX: 80, clientY: 80, identifier: 0 } as Touch,
          { clientX: 220, clientY: 220, identifier: 1 } as Touch,
        ],
      });

      fireEvent.touchEnd(grid, { touches: [], targetTouches: [], changedTouches: [] });

      const zoomValue = parseFloat(getByTestId("zoom-value").textContent ?? "56");
      expect(zoomValue).toBeGreaterThan(56);
    });

    it("zooms out when fingers move together", () => {
      const { getByTestId } = render(<TestComponent />);
      const grid = getByTestId("grid") as HTMLElement;

      fireEvent.touchStart(grid, {
        touches: [
          { clientX: 50, clientY: 50, identifier: 0 } as Touch,
          { clientX: 250, clientY: 250, identifier: 1 } as Touch,
        ],
        targetTouches: [
          { clientX: 50, clientY: 50, identifier: 0 } as Touch,
          { clientX: 250, clientY: 250, identifier: 1 } as Touch,
        ],
        changedTouches: [
          { clientX: 50, clientY: 50, identifier: 0 } as Touch,
          { clientX: 250, clientY: 250, identifier: 1 } as Touch,
        ],
      });

      fireEvent.touchMove(grid, {
        touches: [
          { clientX: 120, clientY: 120, identifier: 0 } as Touch,
          { clientX: 180, clientY: 180, identifier: 1 } as Touch,
        ],
        targetTouches: [
          { clientX: 120, clientY: 120, identifier: 0 } as Touch,
          { clientX: 180, clientY: 180, identifier: 1 } as Touch,
        ],
        changedTouches: [
          { clientX: 120, clientY: 120, identifier: 0 } as Touch,
          { clientX: 180, clientY: 180, identifier: 1 } as Touch,
        ],
      });

      fireEvent.touchEnd(grid, { touches: [], targetTouches: [], changedTouches: [] });

      const zoomValue = parseFloat(getByTestId("zoom-value").textContent ?? "56");
      expect(zoomValue).toBeLessThan(56);
    });
  });
});
