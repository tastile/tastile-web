/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import { useShellStore } from "./shell-store";

const resetStore = () => {
  useShellStore.setState({
    sideBarOpen: true,
    sidebarBehavior: "expandable",
  });
};

beforeEach(() => {
  resetStore();
});

describe("useShellStore.sidebarBehavior", () => {
  it("persists only sidebarBehavior via the partialize shape", () => {
    useShellStore.getState().setSidebarBehavior("open");
    const raw = window.localStorage.getItem("tastile-shell-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as { state?: Record<string, unknown> };
    const persistedKeys = Object.keys(parsed.state ?? {});
    expect(persistedKeys).toContain("sidebarBehavior");
  });
});
