/** @vitest-environment jsdom */
import { fireEvent, screen } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { RowToggle } from "./RowToggle";

describe("RowToggle", () => {
  it("renders a switch reflecting the checked state", () => {
    renderWithMantine(
      <RowToggle icon={BookOpen} placeholder="Period label" checked onChange={() => {}} />,
    );
    const toggle = screen.getByRole("switch");
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it("toggles on click", () => {
    const onChange = vi.fn();
    renderWithMantine(
      <RowToggle icon={BookOpen} placeholder="Period label" checked={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
