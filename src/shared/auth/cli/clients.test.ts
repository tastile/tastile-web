import { describe, expect, it } from "vitest";

import { canonicalScopes, getClient, intersectScopes } from "./clients";

describe("getClient", () => {
  it("returns the registered client for a known id", () => {
    const client = getClient("tastile-cli");
    expect(client?.id).toBe("tastile-cli");
    expect(client?.scopes).toEqual(["tastile.read", "tastile.write"]);
  });

  it("returns undefined for an unknown id (no leakage of registered names)", () => {
    expect(getClient("not-a-client")).toBeUndefined();
    expect(getClient("")).toBeUndefined();
  });
});

describe("intersectScopes", () => {
  it("returns the canonical (sorted, deduped) intersection", () => {
    const result = intersectScopes(
      "tastile.write tastile.read tastile.write",
      ["tastile.read", "tastile.write"],
    );
    expect(result).toEqual(["tastile.read", "tastile.write"]);
  });

  it("returns the subset when only some registered scopes are requested", () => {
    const result = intersectScopes("tastile.read", ["tastile.read", "tastile.write"]);
    expect(result).toEqual(["tastile.read"]);
  });

  it("returns an empty array when nothing intersects (caller maps to 400 invalid_scope)", () => {
    const result = intersectScopes("admin foo.read", ["tastile.read", "tastile.write"]);
    expect(result).toEqual([]);
  });

  it("returns an empty array when the requested string is blank", () => {
    expect(intersectScopes("   ", ["tastile.read"])).toEqual([]);
    expect(intersectScopes("", ["tastile.read"])).toEqual([]);
  });

  it("ignores unknown tokens silently (no throw)", () => {
    const result = intersectScopes(
      "tastile.read unknown.scope",
      ["tastile.read", "tastile.write"],
    );
    expect(result).toEqual(["tastile.read"]);
  });
});

describe("canonicalScopes", () => {
  it("sorts and dedupes", () => {
    expect(canonicalScopes(["tastile.write", "tastile.read", "tastile.write"])).toBe(
      "tastile.read tastile.write",
    );
  });

  it("returns an empty string for an empty input", () => {
    expect(canonicalScopes([])).toBe("");
  });
});
