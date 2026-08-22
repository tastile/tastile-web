import { describe, expect, it } from "vitest";
import { buildSessionJson } from "./route";

describe("buildSessionJson", () => {
  it("returns only sub, exp, and owner_id", () => {
    const json = buildSessionJson({
      sub: "better-auth-user-1",
      exp: 1_900_000_000,
      ownerId: "owner-uuid-1",
    });
    expect(Object.keys(json).sort()).toEqual(["exp", "owner_id", "sub"]);
  });

  it("does NOT include any token in the response shape", () => {
    const json = buildSessionJson({
      sub: "better-auth-user-1",
      exp: null,
      ownerId: null,
    });
    expect(json).not.toHaveProperty("idToken");
    expect(json).not.toHaveProperty("refreshToken");
    expect(json).not.toHaveProperty("sessionToken");
  });

  it("preserves the sub value passed in", () => {
    const json = buildSessionJson({
      sub: "better-auth-user-42",
      exp: null,
      ownerId: null,
    });
    expect(json.sub).toBe("better-auth-user-42");
  });

  it("coerces a null exp into 0", () => {
    const json = buildSessionJson({ sub: "s", exp: null, ownerId: null });
    expect(json.exp).toBe(0);
  });

  it("keeps the resolved owner id", () => {
    const json = buildSessionJson({
      sub: "s",
      exp: 100,
      ownerId: "owner-uuid-9",
    });
    expect(json.owner_id).toBe("owner-uuid-9");
  });
});
