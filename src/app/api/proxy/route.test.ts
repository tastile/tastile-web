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
});
