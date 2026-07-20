import { describe, expect, it, vi } from "vitest";

const cookieStore: Record<string, { value: string; options: Record<string, unknown> }> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (n: string) => cookieStore[n],
  })),
}));

import { cookies } from "next/headers";
import { v5 as uuidv5 } from "uuid";

import { COOKIE_ID_TOKEN } from "./cookies";
import { getAccountOwnerId } from "./account-session";

// MUST match crates/v1/api/src/handlers/common.rs `Uuid::NAMESPACE_OID`
const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

function makeIdToken(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub, exp: 0 })).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("getAccountOwnerId", () => {
  it("returns a UUIDv5 derived from the id_token sub claim", async () => {
    cookieStore[COOKIE_ID_TOKEN] = { value: makeIdToken("abc-123-sub"), options: {} };

    const ownerId = await getAccountOwnerId();
    expect(ownerId).toBe(uuidv5("abc-123-sub", NAMESPACE_OID));
  });

  it("returns null when no id_token cookie is present", async () => {
    for (const k of Object.keys(cookieStore)) delete cookieStore[k];

    expect(await getAccountOwnerId()).toBeNull();
  });

  it("is stable across calls (same sub => same ownerId)", async () => {
    cookieStore[COOKIE_ID_TOKEN] = { value: makeIdToken("stable-sub"), options: {} };

    const a = await getAccountOwnerId();
    const b = await getAccountOwnerId();
    expect(a).toBe(b);
  });
});