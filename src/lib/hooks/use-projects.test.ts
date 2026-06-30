/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCall = vi.fn();
vi.mock("@/lib/api/endpoints", () => ({
  getCoreClient: () => ({ call: mockCall }),
}));

const sampleWorkspace = {
  id: "ws-1",
  kind: 1,
  display_name: "Project 1",
  slug: null,
  email: null,
  color: "#3366ff",
  owner_user_id: "u-1",
  disabled_at: null,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

describe("useProjects", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("loads workspaces on mount", async () => {
    mockCall.mockResolvedValueOnce({
      ok: true,
      data: { items: [sampleWorkspace], count: 1 },
    });

    const { useProjects } = await import("./use-projects");
    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].display_name).toBe("Project 1");
    expect(result.current.error).toBeNull();
  });

  it("surfaces errors when the call fails", async () => {
    mockCall.mockResolvedValueOnce({
      ok: false,
      error: { kind: "server", status: 500, message: "boom", body: null },
    });

    const { useProjects } = await import("./use-projects");
    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.error?.message).toBe("boom");
  });
});
