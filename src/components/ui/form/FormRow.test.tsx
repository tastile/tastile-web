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
    const grid = screen.getByTestId("icon").parentElement?.parentElement;
    expect(grid?.className).toContain("grid");
    expect(grid?.className).toContain("grid-cols-[20px_1fr_auto]");
    expect(grid?.className).toContain("items-center");
    expect(grid?.className).toContain("min-h-row");
  });

  it("places icon in first column", () => {
    render(
      <FormRow icon={<span data-testid="icon">⏱</span>}>
        <span>content</span>
      </FormRow>
    );
    const icon = screen.getByTestId("icon");
    expect(icon.parentElement?.parentElement?.className).toContain("grid-cols-[20px_1fr_auto]");
  });
});
