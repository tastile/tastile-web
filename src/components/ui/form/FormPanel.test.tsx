/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormPanel } from "./FormPanel";

describe("FormPanel", () => {
  it("renders children inside a padded container", () => {
    render(
      <FormPanel>
        <span>row</span>
      </FormPanel>
    );
    const root = screen.getByText("row").parentElement;
    expect(root?.className).toContain("p-panel");
  });

  it("applies a flex column layout with 8px gap between children", () => {
    render(
      <FormPanel>
        <span>one</span>
        <span>two</span>
      </FormPanel>
    );
    const root = screen.getByText("one").parentElement;
    expect(root?.className).toContain("flex");
    expect(root?.className).toContain("flex-col");
    expect(root?.className).toContain("gap-2");
  });

  it("merges custom className", () => {
    render(
      <FormPanel className="extra-class">
        <span>x</span>
      </FormPanel>
    );
    const root = screen.getByText("x").parentElement;
    expect(root?.className).toContain("extra-class");
  });
});
