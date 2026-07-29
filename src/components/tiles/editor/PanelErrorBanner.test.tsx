// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { PanelErrorBanner } from "./PanelErrorBanner";

describe("PanelErrorBanner", () => {
  it("renders title and body with role=alert", () => {
    render(<PanelErrorBanner title="Network error" body="Could not reach server" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Network error");
    expect(alert).toHaveTextContent("Could not reach server");
  });

  it("renders dismiss button when onDismiss provided", async () => {
    const onDismiss = vi.fn();
    render(
      <PanelErrorBanner title="x" body="y" onDismiss={onDismiss} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides dismiss button when onDismiss absent", () => {
    render(<PanelErrorBanner title="x" body="y" />);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});