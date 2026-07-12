/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders the title text", () => {
    const { container } = render(<SectionHeader icon={AlertCircle} title="My section" />);
    expect(container.textContent).toContain("My section");
  });

  it("applies the section-header testid and uppercase muted styling", () => {
    const { container } = render(<SectionHeader icon={AlertCircle} title="Time" />);
    const header = container.querySelector('[data-testid="section-header"]');
    expect(header).not.toBeNull();
    expect(header?.className).toContain("uppercase");
    expect(header?.className).toContain("text-foreground-muted");
  });
});