/** @vitest-environment jsdom */
import { fireEvent, screen } from "@testing-library/react";
import { Repeat } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { RowSubPanel } from "./RowSubPanel";

describe("RowSubPanel", () => {
  it("renders a 48px row with icon, name, value, and chevron", () => {
    renderWithMantine(<RowSubPanel icon={Repeat} name="Recurrence" value="Off" onClick={() => {}} />);
    expect(screen.getByText("Recurrence")).not.toBeNull();
    expect(screen.getByText("Off")).not.toBeNull();
    const button = screen.getByRole("button", { name: /recurrence/i });
    const row = button.closest('[data-testid="form-row"]');
    expect(row?.className).toContain("min-h-row");
  });

  it("calls onClick when the row is pressed", () => {
    const onClick = vi.fn();
    renderWithMantine(<RowSubPanel icon={Repeat} name="Recurrence" value="Off" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /recurrence/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
