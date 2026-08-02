// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StagedSection } from "./StagedSection";

describe("StagedSection", () => {
  it("renders a button with aria-expanded=false when collapsed", () => {
    render(
      <StagedSection title="Plan" isOpen={false} onToggle={() => {}}>
        <div>body</div>
      </StagedSection>,
    );
    const toggle = screen.getByRole("button", { name: "Plan" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("renders children when open and aria-expanded=true", () => {
    render(
      <StagedSection title="Plan" isOpen onToggle={() => {}}>
        <div>body</div>
      </StagedSection>,
    );
    const toggle = screen.getByRole("button", { name: "Plan" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders digest when collapsed", () => {
    render(
      <StagedSection
        title="Plan"
        isOpen={false}
        onToggle={() => {}}
        digest={<span data-testid="digest">3 items</span>}
      >
        <div>body</div>
      </StagedSection>,
    );
    expect(screen.getByTestId("digest")).toBeInTheDocument();
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(
      <StagedSection title="Plan" isOpen={false} onToggle={onToggle}>
        <div>body</div>
      </StagedSection>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows a required indicator when required", () => {
    render(
      <StagedSection title="Identity" required isOpen={false} onToggle={() => {}}>
        <div/>
      </StagedSection>,
    );
    expect(screen.getByText("Identity").parentElement?.textContent).toContain("*");
  });
});