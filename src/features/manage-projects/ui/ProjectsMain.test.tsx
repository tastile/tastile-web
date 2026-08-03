/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsMain } from "./ProjectsMain";
import { renderWithMantine } from "@/test/render-with-mantine";

const mockUpdateWorkspace = vi.fn();
const mockRefresh = vi.fn();
const mockUseTileList = vi.fn();

const refresh = vi.fn(async () => {});

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/projects",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("owner=ws-1"),
}));

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [
      {
        id: "ws-1",
        kind: 0,
        display_name: "Test project",
        slug: "test-project",
        email: null,
        parent_subject_id: null,
        color: "#6b7280",
        owner_user_id: null,
        disabled_at: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
  updateWorkspace: (...args: unknown[]) => mockUpdateWorkspace(...args),
}));

vi.mock("@/lib/hooks/use-tile-list", () => ({
  useTileList: (...args: unknown[]) => {
    mockUseTileList(...args);
    return { tiles: [], loading: false };
  },
}));

vi.mock("@/tile/ui/TileCardCompact", () => ({
  TileCardCompact: ({ tile }: { tile: { id: string } }) => <li>{tile.id}</li>,
}));

beforeEach(() => {
  mockUpdateWorkspace.mockReset();
  mockRefresh.mockReset();
  refresh.mockClear();
  mockUseTileList.mockReset();
  mockUpdateWorkspace.mockResolvedValue({} as never);
  mockRefresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectsMain project save flow", () => {
  it("calls updateWorkspace and refresh on save, resetting saving state", async () => {
    mockUpdateWorkspace.mockResolvedValue({
      id: "ws-1",
      kind: 0,
      display_name: "Renamed",
      slug: null,
      email: null,
      parent_subject_id: null,
      color: "#6b7280",
      owner_user_id: null,
      disabled_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    mockRefresh.mockResolvedValue(undefined);

    renderWithMantine(<ProjectsMain />);

    const saveButton = screen.getByRole("button", { name: /Save|Saving/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateWorkspace).toHaveBeenCalledTimes(1));
    expect(mockUpdateWorkspace).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        display_name: "Test project",
      }),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Saving flag must reset after the request completes.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save/i })).toBeTruthy();
    });
  });

  it("shows error message and resets saving flag when updateWorkspace rejects", async () => {
    mockUpdateWorkspace.mockRejectedValue(new Error("server exploded"));

    renderWithMantine(<ProjectsMain />);

    fireEvent.click(screen.getByRole("button", { name: /Save|Saving/i }));

    await waitFor(() => expect(mockUpdateWorkspace).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("server exploded")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save/i })).toBeTruthy();
    });
  });
});
