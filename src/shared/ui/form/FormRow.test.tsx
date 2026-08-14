/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { FormRow } from "./FormRow";

describe("FormRow", () => {
  it("renders a 2-column grid (icon + content) with 48px min height", () => {
    renderWithMantine(
      <FormRow icon={<span data-testid="icon" />} trailing={<span data-testid="trailing" />}>
        <span data-testid="content">content</span>
      </FormRow>,
    );
    const grid = screen.getByTestId("form-row");
    expect(grid.className).toContain("grid");
    // Trailing lives inside the content cell (right-justified) rather than
    // as a third auto-sized grid track — this keeps the underline flush
    // with the panel's right edge.
    expect(grid.className).toContain("grid-cols-[20px_1fr]");
    expect(grid.className).not.toContain("grid-cols-[20px_1fr_auto]");
    expect(grid.className).toContain("items-center");
    expect(grid.className).toContain("min-h-row");
  });

  it("renders the trailing element inside the content cell when provided", () => {
    renderWithMantine(
      <FormRow icon={<span data-testid="icon" />} trailing={<span data-testid="trailing" />}>
        <span>content</span>
      </FormRow>,
    );
    const trailing = screen.getByTestId("trailing");
    expect(trailing).not.toBeNull();
    // The trailing element should be a descendant of the content cell,
    // not a sibling of the icon column (i.e. not a separate grid track).
    const grid = screen.getByTestId("form-row");
    const contentCell = grid.children[1];
    expect(contentCell.contains(trailing)).toBe(true);
  });

  it("omits the trailing element when trailing is undefined", () => {
    renderWithMantine(
      <FormRow icon={<span data-testid="icon" />}>
        <span>content</span>
      </FormRow>,
    );
    expect(screen.queryByTestId("trailing")).toBeNull();
  });

  it("uses the 44px tight min-height when tight is true", () => {
    renderWithMantine(
      <FormRow tight icon={<span data-testid="icon" />}>
        <span>content</span>
      </FormRow>,
    );
    const grid = screen.getByTestId("form-row");
    expect(grid.className).toContain("min-h-row-tight");
    expect(grid.className.includes("min-h-row ")).toBe(false);
  });

  it("keeps the 20px icon-column track when icon is omitted", () => {
    // Structural alignment: title rows (no icon) share the same grid as
    // field rows, so the content column always starts at the same offset.
    renderWithMantine(
      <FormRow>
        <span data-testid="content">title</span>
      </FormRow>,
    );
    const grid = screen.getByTestId("form-row");
    expect(grid.className).toContain("grid-cols-[20px_1fr]");
    expect(screen.getByTestId("content")).not.toBeNull();
  });
});
