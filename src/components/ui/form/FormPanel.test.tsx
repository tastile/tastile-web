/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { FormPanel } from "./FormPanel";

describe("FormPanel", () => {
  it("renders children inside a padded container", () => {
    renderWithMantine(
      <FormPanel>
        <span>row</span>
      </FormPanel>,
    );
    const root = screen.getByTestId("form-panel");
    expect(root.className).toContain("p-panel");
  });

  it("lays out children as a column with stack spacing", () => {
    renderWithMantine(
      <FormPanel>
        <span>one</span>
        <span>two</span>
      </FormPanel>,
    );
    const root = screen.getByTestId("form-panel");
    expect(root.className).toMatch(/mantine-Stack-root/);
  });

  it("merges custom className with the base classes", () => {
    renderWithMantine(
      <FormPanel className="extra-class">
        <span>x</span>
      </FormPanel>,
    );
    const root = screen.getByTestId("form-panel");
    expect(root.className).toContain("p-panel");
    expect(root.className).toContain("extra-class");
  });
});
