/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormRow } from "./FormRow";

describe("FormRow", () => {
  it("renders a 3-column grid with 48px min height", () => {
    render(
      <FormRow icon={<span data-testid="icon" />} trailing={<span data-testid="trailing" />}>
        <span data-testid="content">content</span>
      </FormRow>
    );
    const grid = screen.getByTestId("form-row");
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-[20px_1fr_auto]");
    expect(grid.className).toContain("items-center");
    expect(grid.className).toContain("min-h-row");
  });

  it("renders the trailing element when provided", () => {
    render(
      <FormRow icon={<span data-testid="icon" />} trailing={<span data-testid="trailing" />}>
        <span>content</span>
      </FormRow>
    );
    expect(screen.getByTestId("trailing")).not.toBeNull();
  });

  it("omits the trailing column when trailing is undefined", () => {
    render(
      <FormRow icon={<span data-testid="icon" />}>
        <span>content</span>
      </FormRow>
    );
    expect(screen.queryByTestId("trailing")).toBeNull();
  });

  it("uses the 44px tight min-height when tight is true", () => {
    render(
      <FormRow tight icon={<span data-testid="icon" />}>
        <span>content</span>
      </FormRow>
    );
    const grid = screen.getByTestId("form-row");
    expect(grid.className).toContain("min-h-row-tight");
    // Class tokens are space-separated; assert "min-h-row " (with trailing space) is absent
    // so the tight branch is genuinely selected rather than prefixed.
    expect(grid.className.includes("min-h-row ")).toBe(false);
  });
});
