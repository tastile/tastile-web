import { describe, expect, it } from "vitest";

describe("api proxy v1 path compatibility", () => {
  it("maps runtime and auth compatibility paths to tastile-core v1 routes", async () => {
    process.env.CLOUD_API_BASE = "http://core.local";
    const { toV1Path } = await import("./[...path]/route");

    expect(toV1Path("read/runtime-paths")).toBe("v1/runtime/paths");
    expect(toV1Path("auth/session")).toBe("v1/auth/session");
    expect(toV1Path("auth/session/restore")).toBe("v1/auth/session/restore");
    expect(toV1Path("commands/recurring-tile")).toBe("v1/tiles");
  });

  it("maps pending-prompt and prompts/current to v1/prompts/pending", async () => {
    const { toV1Path } = await import("./[...path]/route");
    expect(toV1Path("views/pending-prompt")).toBe("v1/prompts/pending");
    expect(toV1Path("prompts/current")).toBe("v1/prompts/pending");
  });

  it("injects start AND end for views/timeline/today", async () => {
    const { injectTimelineTodayDefaults } = await import("./[...path]/route");
    const params = new URLSearchParams("");
    injectTimelineTodayDefaults(params);
    expect(params.get("start")).toBeDefined();
    expect(params.get("end")).toBeDefined();
    // end = start + 24h
    expect(
      new Date(params.get("end")!).getTime() -
        new Date(params.get("start")!).getTime(),
    ).toBe(24 * 3600 * 1000);
  });

  it("preserves explicit start and end without overwrite", async () => {
    const { injectTimelineTodayDefaults } = await import("./[...path]/route");
    const params = new URLSearchParams(
      "start=2026-06-01T00:00:00Z&end=2026-06-02T00:00:00Z",
    );
    injectTimelineTodayDefaults(params);
    expect(params.get("start")).toBe("2026-06-01T00:00:00Z");
    expect(params.get("end")).toBe("2026-06-02T00:00:00Z");
  });
});
