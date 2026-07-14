/** @vitest-environment jsdom */
import { fireEvent, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { RowSegmented } from "./RowSegmented";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("RowSegmented", () => {
  it("renders one radio per option", () => {
    renderWithMantine(
      <RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: "A" })).not.toBeNull();
    expect(screen.getByRole("radio", { name: "B" })).not.toBeNull();
  });

  it("marks the active option as the checked radio", () => {
    renderWithMantine(
      <RowSegmented icon={CheckCircle2} options={OPTIONS} value="b" onChange={() => {}} />,
    );
    expect((screen.getByRole("radio", { name: "A" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "B" }) as HTMLInputElement).checked).toBe(true);
  });

  it("calls onChange when an option is clicked", () => {
    const onChange = vi.fn();
    renderWithMantine(
      <RowSegmented icon={CheckCircle2} options={OPTIONS} value="a" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
