/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowSegmented } from "./RowSegmented";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("RowSegmented", () => {
  it("renders one button per option with role=radio", () => {
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={() => {}} />);
    const a = screen.getByRole("radio", { name: "A" });
    const b = screen.getByRole("radio", { name: "B" });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it("marks the active option as aria-checked", () => {
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="b" onChange={() => {}} />);
    const a = screen.getByRole("radio", { name: "A" });
    const b = screen.getByRole("radio", { name: "B" });
    expect(a.getAttribute("aria-checked")).toBe("false");
    expect(b.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange when an option is clicked", () => {
    const onChange = vi.fn();
    render(<RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
