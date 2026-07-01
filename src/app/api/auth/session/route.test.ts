import { describe, expect, it } from "vitest";
import { buildSessionJson } from "./route";

describe("buildSessionJson", () => {
  it("returns only sub, exp, and owner_id", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: undefined,
      ownerId: "owner-uuid-1",
    });
    expect(Object.keys(json).sort()).toEqual(["exp", "owner_id", "sub"]);
  });

  it("does NOT include idToken in the response shape", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: "header.payload.sig",
      ownerId: null,
    });
    expect(json).not.toHaveProperty("idToken");
  });

  it("does NOT include refreshToken in the response shape", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: undefined,
      ownerId: null,
    });
    expect(json).not.toHaveProperty("refreshToken");
  });

  it("preserves the sub value passed in", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-42",
      idToken: undefined,
      ownerId: null,
    });
    expect(json.sub).toBe("cognito-sub-42");
  });

  it("preserves owner_id when resolved by the bridge", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: undefined,
      ownerId: "11111111-1111-1111-1111-111111111111",
    });
    expect(json.owner_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("keeps owner_id as null when the bridge did not yield an owner", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: undefined,
      ownerId: null,
    });
    expect(json.owner_id).toBeNull();
  });

  it("decodes JWT exp claim when a valid idToken is supplied", () => {
    // node-runtime: rely on Buffer for base64url decode (matches route.ts).
    const header = Buffer.from('{"alg":"none"}').toString("base64url");
    const payload = JSON.stringify({ exp: 1735689600 });
    const payloadB64 = Buffer.from(payload).toString("base64url");
    const fakeJwt = `${header}.${payloadB64}.signature`;

    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: fakeJwt,
      ownerId: null,
    });
    expect(json.exp).toBe(1735689600);
  });

  it("decodes exp as 0 when idToken is undefined", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: undefined,
      ownerId: null,
    });
    expect(json.exp).toBe(0);
  });

  it("decodes exp as 0 when idToken is malformed", () => {
    const json = buildSessionJson({
      sub: "cognito-sub-1",
      idToken: "not-a-jwt",
      ownerId: null,
    });
    expect(json.exp).toBe(0);
  });
});
