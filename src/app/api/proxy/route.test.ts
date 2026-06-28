import { describe, expect, it } from "vitest";
import { toV1Path } from "./[...path]/route";

describe("api proxy v1 path compatibility", () => {
  it("maps runtime and auth compatibility paths to tastile-core v1 routes", () => {
    expect(toV1Path("read/runtime-paths")).toBe("v1/runtime/paths");
    expect(toV1Path("auth/session")).toBe("v1/auth/session");
    expect(toV1Path("auth/session/restore")).toBe("v1/auth/session/restore");
    expect(toV1Path("commands/recurring-tile")).toBe("v1/tiles");
  });
});
