// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldRow } from "./FieldRow";

describe("FieldRow", () => {
  it("renders label linked to control by id", () => {
    render(
      <FieldRow label="Title" htmlFor="title-input">
        <input id="title-input" />
      </FieldRow>,
    );
    const label = screen.getByText("Title");
    expect(label).toHaveAttribute("for", "title-input");
  });

  it("renders hint with aria-describedby", () => {
    render(
      <FieldRow label="Title" htmlFor="t" hint="max 80 chars">
        <input id="t" />
      </FieldRow>,
    );
    const input = screen.getByLabelText("Title");
    const hintId = input.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    expect(screen.getByText("max 80 chars").id).toBe(hintId);
  });

  it("renders error with aria-errormessage and role=alert", () => {
    render(
      <FieldRow label="Title" htmlFor="t" error="Required">
        <input id="t" />
      </FieldRow>,
    );
    const input = screen.getByLabelText("Title");
    const errId = input.getAttribute("aria-errormessage");
    expect(errId).toBeTruthy();
    const err = screen.getByRole("alert");
    expect(err.id).toBe(errId);
    expect(err.textContent).toBe("Required");
  });

  it("renders required indicator", () => {
    render(
      <FieldRow label="Title" htmlFor="t" required>
        <input id="t" />
      </FieldRow>,
    );
    const label = screen.getByText("Title");
    expect(label.parentElement?.textContent).toContain("*");
  });
});
