/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { FormDivider } from "./FormDivider";

describe("FormDivider", () => {
  it("renders a Mantine Divider", () => {
    renderWithMantine(<FormDivider />);
    const divider = screen.getByTestId("form-divider");
    expect(divider).not.toBeNull();
    expect(divider.className).toContain("mantine-Divider-root");
  });
});
