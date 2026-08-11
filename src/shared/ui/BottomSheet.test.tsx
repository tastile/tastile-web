// @vitest-environment jsdom

import { renderWithMantine } from "@/test/render-with-mantine";
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

describe("BottomSheet", () => {
  it("keeps a valid accessible drawer title without nested headings", () => {
    renderWithMantine(
      <BottomSheet open onOpenChange={vi.fn()} title="Mobile menu">
        <p>Menu content</p>
      </BottomSheet>,
    );

    const title = screen.getByRole("heading", { name: "Mobile menu", level: 2 });
    expect(title.tagName).toBe("H2");
    expect(title.querySelector("h2")).toBeNull();
    expect(title.closest("[class*='rounded-t-md']")).toBeInTheDocument();
  });
});
