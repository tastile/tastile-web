/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { RowInput } from "./RowInput";

describe("RowInput", () => {
  it("renders a 48px row with a 20px icon and an input", () => {
    renderWithMantine(<RowInput icon={Clock} placeholder="00:25" />);
    const input = screen.getByPlaceholderText("00:25");
    expect(input).not.toBeNull();
    const row = input.closest('[data-testid="form-row"]');
    expect(row?.className).toContain("min-h-row");
    const svg = row?.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
  });

  it("forwards value", () => {
    renderWithMantine(<RowInput icon={Clock} placeholder="x" value="abc" onChange={() => {}} />);
    expect(screen.getByDisplayValue("abc")).not.toBeNull();
  });
});
