/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { ProjectColorRow } from "./ProjectColorRow";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
  orderWorkspaceTree: (items: unknown[]) =>
    (items as Array<{ id: string; display_name: string }>).map((w, depth) => ({
      workspace: w,
      depth,
    })),
}));

import { useWorkspaces } from "@/shared/hooks/use-workspaces";

const mockUseWorkspaces = vi.mocked(useWorkspaces);

const SWATCHES = ["#3b82f6", "#10b981", "#a855f7"];

function resetStore() {
  useQuickCreateStore.setState({
    identity: {
      kind: 0,
      title: "",
      description: null,
      externalId: null,
      visual: { color: "#3b82f6", icon: "check-circle" },
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("ProjectColorRow", () => {
  beforeEach(() => {
    resetStore();
    mockUseWorkspaces.mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("renders the project picker and the color input with the given testIds", () => {
    renderWithMantine(
      <ProjectColorRow
        pickerTestId="picker-test-id"
        colorTestId="color-test-id"
        swatches={SWATCHES}
      />,
    );
    expect(screen.getByTestId("picker-test-id")).toBeInTheDocument();
    expect(screen.getByTestId("color-test-id")).toBeInTheDocument();
  });

  it("reflects the current identity.visual.color as the color input value", () => {
    useQuickCreateStore.setState((state) => ({
      identity: {
        ...state.identity,
        visual: { color: "#a855f7", icon: "check-circle" },
      },
    }));
    renderWithMantine(
      <ProjectColorRow
        pickerTestId="picker-test-id"
        colorTestId="color-test-id"
        swatches={SWATCHES}
      />,
    );
    const colorInput = screen.getByTestId("color-test-id") as HTMLInputElement;
    expect(colorInput.value).toBe("#a855f7");
  });
});
