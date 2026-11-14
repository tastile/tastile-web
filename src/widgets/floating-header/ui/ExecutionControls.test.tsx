/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { V1ActiveTileSnapshot } from "@/shared/api/v1/active-tile";
import { renderWithMantine } from "@/test/render-with-mantine";

const { activeTile } = vi.hoisted(() => ({
  activeTile: { current: null as V1ActiveTileSnapshot | null },
}));

vi.mock("@/shared/hooks/use-v1-active-tile", () => ({
  useV1ActiveTile: () => ({ snapshot: activeTile.current, loading: false, error: null }),
}));

import { ExecutionControls } from "./ExecutionControls";

const base: V1ActiveTileSnapshot = {
  tile_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8e",
  placement_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8f",
  execution_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d90",
  title: "Plan the launch",
  span_start: "2026-07-23T09:00:00.000Z",
  span_end: "2026-07-23T10:00:00.000Z",
  execution_state: 0,
};

afterEach(() => {
  activeTile.current = null;
});

describe("ExecutionControls", () => {
  it("offers pause and finish while the execution is active", () => {
    activeTile.current = base;
    renderWithMantine(<ExecutionControls />);
    expect(screen.getByRole("button", { name: /pause|一時停止/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resume|再開/i })).toBeNull();
    expect(screen.getByTestId("execution-finish")).toBeTruthy();
  });

  it("offers resume and finish while the execution is paused", () => {
    activeTile.current = { ...base, execution_state: 1 };
    renderWithMantine(<ExecutionControls />);
    expect(screen.getByRole("button", { name: /resume|再開/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pause|一時停止/i })).toBeNull();
    expect(screen.getByTestId("execution-finish")).toBeTruthy();
  });
});
