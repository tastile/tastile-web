/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubmitBar } from "./SubmitBar";

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe("SubmitBar", () => {
  const baseProps = {
    canSubmit: true,
    blockedReason: null,
    isSubmitting: false,
    serverError: null,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    submitLabel: "Create tile",
    cancelLabel: "Cancel",
  };

  it("renders submit and cancel buttons enabled when canSubmit", () => {
    render(<MantineProvider><SubmitBar {...baseProps} /></MantineProvider>);
    expect(screen.getByRole("button", { name: "Create tile" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("disables submit when canSubmit=false", () => {
    render(<MantineProvider><SubmitBar {...baseProps} canSubmit={false} /></MantineProvider>);
    expect(screen.getByRole("button", { name: "Create tile" })).toBeDisabled();
  });

  it("shows blocked reason text below the button", () => {
    render(<MantineProvider><SubmitBar {...baseProps} canSubmit={false} blockedReason="Title required" /></MantineProvider>);
    expect(screen.getByText("Title required")).toBeInTheDocument();
  });

  it("shows loading spinner when isSubmitting", () => {
    render(<MantineProvider><SubmitBar {...baseProps} isSubmitting /></MantineProvider>);
    const btn = screen.getByRole("button", { name: "Create tile" });
    expect(btn).toHaveAttribute("data-loading", "true");
  });

  it("renders serverError via PanelErrorBanner", () => {
    render(
      <MantineProvider>
        <SubmitBar
          {...baseProps}
          serverError={{ title: "Server error", body: "Try again" }}
        />
      </MantineProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Server error");
  });

  it("calls onSubmit when submit clicked", async () => {
    const onSubmit = vi.fn();
    render(<MantineProvider><SubmitBar {...baseProps} onSubmit={onSubmit} /></MantineProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Create tile" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel clicked", async () => {
    const onClose = vi.fn();
    render(<MantineProvider><SubmitBar {...baseProps} onClose={onClose} /></MantineProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
