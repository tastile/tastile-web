/** @vitest-environment jsdom */
import { act, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { SidePanelProvider, useSidePanel, useSidePanelContent } from "./side-panel-context";

interface Probe {
  pushes: number;
  lastContent: unknown;
}

function StableContentFixture({ onPushCount }: { onPushCount: (n: number) => void }) {
  const [tick, setTick] = useState(0);
  // Reference-stable React element across renders.
  const [content] = useState(() => <div>hello</div>);
  useSidePanel(content);

  // Force parent rerenders; if `content` were re-created each render the
  // side-panel store would receive a new reference and notify subscribers.
  // Stable reference → no extra notifications.
  useEffect(() => {
    const id = setInterval(() => {
      act(() => setTick((t) => t + 1));
    }, 20);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-testid="fixture">
      <SubscriberCounter onPushCount={onPushCount} />
      <span data-testid="tick">tick={tick}</span>
    </div>
  );
}

function SubscriberCounter({ onPushCount }: { onPushCount: (n: number) => void }) {
  const content = useSidePanelContent();
  const [count, setCount] = useState(0);

  // The content prop changes reference only when the store replaces it.
  // With a stable panel element, this effect must fire exactly once
  // (initial mount), regardless of how many parent rerenders occur.
  useEffect(() => {
    setCount((c) => c + 1);
    onPushCount(count + 1);
  }, [content, count, onPushCount]);

  return <div data-testid="probe">pushes={count}</div>;
}

describe("useSidePanel reference-stability contract", () => {
  it("fires the subscriber effect at most once when the pushed element is reference-stable", async () => {
    let lastPushes = 0;
    const record = (n: number) => {
      lastPushes = n;
    };

    const { unmount } = render(
      <SidePanelProvider>
        <StableContentFixture onPushCount={record} />
      </SidePanelProvider>,
    );

    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    unmount();

    // The fixture deliberately re-renders itself every 20ms. With a stable
    // panel element, the subscriber effect (keyed on content reference)
    // must fire at most once.
    expect(lastPushes).toBeLessThanOrEqual(1);
  });
});