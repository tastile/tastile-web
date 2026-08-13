/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowMenu } from "./WorkflowMenu";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

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

function renderWithMantine(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("WorkflowMenu", () => {
  beforeEach(() => {
    useQuickCreateStore.setState({ workflowKind: null });
  });

  afterEach(() => {
    useQuickCreateStore.setState({ workflowKind: null });
  });

  it("opens the menu when the trigger is clicked and lists all three workflows", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <WorkflowMenu trigger={<button type="button">open</button>} />,
    );

    expect(
      screen.queryByTestId("workflow-menu-item-event"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("workflow-menu-trigger"));

    expect(screen.getByTestId("workflow-menu-item-event")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-menu-item-task")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-menu-item-recurring")).toBeInTheDocument();
  });

  it("selects a workflow, writes it to the store, and closes the menu", async () => {
    const user = userEvent.setup();
    const setWorkflowSpy = vi.fn();
    const setWorkflow = useQuickCreateStore.getState().setWorkflow;
    useQuickCreateStore.setState({
      setWorkflow: ((kind: Parameters<typeof setWorkflow>[0]) => {
        setWorkflowSpy(kind);
        setWorkflow(kind);
      }) as typeof setWorkflow,
    });

    renderWithMantine(
      <WorkflowMenu trigger={<button type="button">open</button>} />,
    );

    await user.click(screen.getByTestId("workflow-menu-trigger"));
    await user.click(screen.getByTestId("workflow-menu-item-task"));

    expect(setWorkflowSpy).toHaveBeenCalledWith("task");
    expect(useQuickCreateStore.getState().workflowKind).toBe("task");
    expect(
      screen.queryByTestId("workflow-menu-item-task"),
    ).not.toBeInTheDocument();
  });

  it("invokes the onSelect callback with the chosen workflow", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderWithMantine(
      <WorkflowMenu
        trigger={<button type="button">open</button>}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByTestId("workflow-menu-trigger"));
    await user.click(screen.getByTestId("workflow-menu-item-event"));

    expect(onSelect).toHaveBeenCalledWith("event");
  });
});
