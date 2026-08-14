/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreate } from "./QuickCreate";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
  orderWorkspaceTree: (items: unknown[]) =>
    (items as Array<{ id: string; display_name: string }>).map((w, depth) => ({
      workspace: w,
      depth,
    })),
}));

vi.mock("@/shared/hooks/use-tile-list", () => ({
  useTileList: vi.fn(),
}));

vi.mock("@/shared/hooks/use-media-query", () => ({
  useIsDesktop: vi.fn(),
}));

vi.mock("@/shared/hooks/calendar/use-events", () => ({
  notifyEventsChanged: vi.fn(),
}));

vi.mock("@/shared/api/v1/submit", () => ({
  makeClient: vi.fn(),
  submitTile: vi.fn(),
  submitUpdateTile: vi.fn(),
  SubmitError: class SubmitError extends Error {},
  SubmitValidationError: class SubmitValidationError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { useIsDesktop } from "@/shared/hooks/use-media-query";
import { useTileList } from "@/shared/hooks/use-tile-list";
import { useWorkspaces } from "@/shared/hooks/use-workspaces";

const mockUseWorkspaces = vi.mocked(useWorkspaces);
const mockUseTileList = vi.mocked(useTileList);
const mockUseIsDesktop = vi.mocked(useIsDesktop);

// Mantine's Autosize Textarea calls scrollIntoView on mount.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Mantine's Autosize listens on `document.fonts` for font-loading events.
// jsdom does not implement the Font Loading API, so stub the interface.
if (
  typeof document !== "undefined" &&
  typeof (document as { fonts?: unknown }).fonts === "undefined"
) {
  (document as unknown as { fonts: { addEventListener: () => void; removeEventListener: () => void } }).fonts = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function seedDetailedWorkflow() {
  // Use the store's own `openCreate` to seed defaults for every slice;
  // it sets isOpen: true and lets `defaultsForWorkflow("detailed")` apply.
  // Then flip workflowKind to "detailed" so the QuickCreate body renders.
  useQuickCreateStore.getState().openCreate({ workflow: "detailed" });
  useQuickCreateStore.setState({ canSubmit: true });
}

describe("QuickCreate (detailed workflow)", () => {
  beforeEach(() => {
    seedDetailedWorkflow();
    mockUseWorkspaces.mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    mockUseTileList.mockReturnValue({
      tiles: [],
      nextActionableTileId: null,
      nextActionableStartAt: null,
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    mockUseIsDesktop.mockReturnValue(false);
  });

  afterEach(() => {
    // NOTE: don't call `useQuickCreateStore.getState().close()` here —
    // QuickCreate has an early-return guard after its mounted hook, so
    // setting isOpen=false during cleanup would trigger React's
    // "Rendered fewer hooks than expected" warning. Vitest's automatic
    // unmount and the beforeEach re-seed keep state isolated.
    vi.clearAllMocks();
  });

  it("renders the shared MemoSection, ProjectColorRow, and color input in the main body", () => {
    renderWithMantine(<QuickCreate />);

    expect(screen.getByTestId("detailed-memo")).toBeInTheDocument();
    expect(screen.getByTestId("detailed-project-picker")).toBeInTheDocument();
    expect(screen.getByTestId("detailed-color")).toBeInTheDocument();
  });

  it("writes the typed memo to meta.memo in the store", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreate />);

    const memo = screen.getByTestId("detailed-memo");
    await user.type(memo, "remember");

    expect(useQuickCreateStore.getState().meta.memo).toBe("remember");
  });
});
