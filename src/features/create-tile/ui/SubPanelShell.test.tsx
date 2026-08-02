// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";
import { SubPanelShell } from "./SubPanelShell";

function getRegion(activeKey: "intent" | "base", layout: "drawer" | "sheet" = "drawer") {
  const { container } = render(
    <SubPanelShell
      panelKey="intent"
      activeKey={activeKey}
      onClose={vi.fn()}
      headingId="intent-heading"
      title="Intent"
      layout={layout}
    >
      <p>body</p>
    </SubPanelShell>,
  );
  const region = container.querySelector(
    'section[aria-labelledby="intent-heading"]',
  ) as HTMLElement;
  expect(region).not.toBeNull();
  return region;
}

describe("SubPanelShell", () => {
  const baseProps = {
    panelKey: "intent" as const,
    headingId: "intent-heading",
    title: "Intent",
    onClose: vi.fn(),
    layout: "drawer" as const,
    children: <p>body</p>,
  };

  it("renders children when active", () => {
    render(<SubPanelShell {...baseProps} activeKey="intent" />);
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("hides and inerts when idle", () => {
    const region = getRegion("base");
    expect(region).toHaveAttribute("aria-hidden", "true");
    expect(region).toHaveAttribute("inert");
  });

  it("uses translate-x-full when idle on desktop drawer", () => {
    const region = getRegion("base", "drawer");
    expect(region.className).toContain("translate-x-full");
  });

  it("uses translate-y-full when idle on mobile sheet", () => {
    const region = getRegion("base", "sheet");
    expect(region.className).toContain("translate-y-full");
  });

  it("uses translate-x-0 when active on desktop drawer", () => {
    const region = getRegion("intent", "drawer");
    expect(region.className).toContain("translate-x-0");
  });

  it("calls onClose when Esc is pressed", () => {
    const onClose = vi.fn();
    render(<SubPanelShell {...baseProps} activeKey="intent" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets aria-labelledby to the heading id", () => {
    const region = getRegion("intent");
    expect(region).toHaveAttribute("aria-labelledby", "intent-heading");
  });

  it("marks the root with data-panel-anim for reduced-motion targeting", () => {
    const region = getRegion("intent");
    expect(region).toHaveAttribute("data-panel-anim", "");
  });

  it("accepts the extended panel keys used by QuickCreate", () => {
    const { rerender, container } = render(
      <SubPanelShell
        panelKey="references"
        activeKey="references"
        onClose={vi.fn()}
        headingId="references-heading"
        title="References"
        layout="drawer"
      >
        <p>refs</p>
      </SubPanelShell>,
    );
    expect(
      container.querySelector('section[aria-labelledby="references-heading"]'),
    ).not.toBeNull();
    rerender(
      <SubPanelShell
        panelKey="references"
        activeKey="meta"
        onClose={vi.fn()}
        headingId="references-heading"
        title="References"
        layout="drawer"
      >
        <p>refs</p>
      </SubPanelShell>,
    );
    const region = container.querySelector(
      'section[aria-labelledby="references-heading"]',
    ) as HTMLElement;
    expect(region).toHaveAttribute("aria-hidden", "true");
  });
});