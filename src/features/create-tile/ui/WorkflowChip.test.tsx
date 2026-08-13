/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkflowChip } from "./WorkflowChip";

describe("WorkflowChip", () => {
  it("shows the picker label when no workflow is selected", () => {
    render(<WorkflowChip workflow={null} aria-label="Switch workflow" />);
    // Default test locale is ja; "Workflow" key resolves to "ワークフロー".
    expect(screen.getByText("ワークフロー")).toBeInTheDocument();
  });

  it("shows the workflow label when one is selected", () => {
    render(<WorkflowChip workflow="event" aria-label="Switch workflow" />);
    expect(screen.getByText("予定")).toBeInTheDocument();
  });

  it("renders a chevron indicating the menu opens", () => {
    const { container } = render(
      <WorkflowChip workflow="recurring" aria-label="Switch workflow" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
