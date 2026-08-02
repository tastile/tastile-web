/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { describe, expect, it } from "vitest";

import { renderWithMantine } from "@/test/render-with-mantine";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders the title text", () => {
    renderWithMantine(<SectionHeader icon={AlertCircle} title="My section" />);
    expect(screen.getByText("My section")).not.toBeNull();
  });

  it("applies the section-header testid and uppercase muted styling", () => {
    renderWithMantine(<SectionHeader icon={AlertCircle} title="Time" />);
    const header = screen.getByTestId("section-header");
    expect(header).not.toBeNull();
    expect(header.className).toContain("uppercase");
    expect(header.className).toContain("text-foreground-muted");
  });
});
