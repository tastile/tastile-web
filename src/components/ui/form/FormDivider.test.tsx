/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormDivider } from "./FormDivider";

describe("FormDivider", () => {
  it("renders a horizontal rule with 16px vertical margin and a border", () => {
    const { container } = render(<FormDivider />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
    expect(hr?.className).toContain("my-4");
    expect(hr?.className).toContain("border-border");
  });
});
