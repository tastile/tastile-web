/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowToggle } from "./RowToggle";

describe("RowToggle", () => {
  it("renders a switch with aria-checked reflecting state", () => {
    render(<RowToggle icon={BookOpen} placeholder="Period label" checked onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles on click", () => {
    const onChange = vi.fn();
    render(<RowToggle icon={BookOpen} placeholder="Period label" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
