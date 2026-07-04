/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppState } from "../core/state";
import { Actor } from "../domain/actor";

afterEach(() => {
  vi.resetModules();
});

describe("useDaemonExecution (v1 stub)", () => {
  it("returns the initial AppState and a never-loading marker", async () => {
    const { useDaemonExecution } = await import("./use-daemon-execution");
    const { result } = renderHook(() => useDaemonExecution());
    expect(result.current.loading).toBe(false);
    expect(result.current.state).toStrictEqual(AppState.initial());
  });

  it("execute() throws to surface the retired browser execution engine", async () => {
    const { useDaemonExecution } = await import("./use-daemon-execution");
    const { result } = renderHook(() => useDaemonExecution());
    await expect(
      result.current.execute(
        {
          // Cast: any concrete command shape triggers the same throw.
          type: "request_prompt",
          tile_id: null,
          requested_at: new Date(),
          reason: "test",
        } as never,
        Actor.human("self"),
      ),
    ).rejects.toThrow(/removed in v1/);
  });
});
