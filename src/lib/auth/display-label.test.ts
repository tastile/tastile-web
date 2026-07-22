import { describe, expect, it } from "vitest";
import { emailLocalPart, pickDisplayLabel } from "./display-label";

describe("pickDisplayLabel", () => {
  const ownerId = "6bd31b87-e2a4-4e08-bf12-aabbccddeeff";
  const sub = "cognito-sub-1234567890";

  it("returns trimmed display_name when present", () => {
    expect(
      pickDisplayLabel({
        displayName: "  Yuki Tanaka  ",
        email: "yuki@example.com",
        ownerId,
        sub,
      }),
    ).toBe("Yuki Tanaka");
  });

  it("returns email local part when display_name is missing", () => {
    expect(
      pickDisplayLabel({
        displayName: null,
        email: "john.smith@example.com",
        ownerId,
        sub,
      }),
    ).toBe("john.smith");
  });

  it("returns email local part when display_name is empty string", () => {
    expect(
      pickDisplayLabel({
        displayName: "",
        email: "alice@example.com",
        ownerId,
        sub,
      }),
    ).toBe("alice");
  });

  it("falls back to owner_id slice when no display_name and no email", () => {
    expect(
      pickDisplayLabel({
        displayName: null,
        email: null,
        ownerId,
        sub,
      }),
    ).toBe("6bd31b87");
  });

  it("falls back to sub slice when no owner_id, no display_name, no email", () => {
    expect(
      pickDisplayLabel({
        displayName: null,
        email: null,
        ownerId: null,
        sub,
      }),
    ).toBe("cognito-");
  });

  it("ignores invalid email formats and falls back to owner_id slice", () => {
    expect(
      pickDisplayLabel({
        displayName: null,
        email: "@no-local-part.com",
        ownerId,
        sub,
      }),
    ).toBe("6bd31b87");
  });

  it("ignores bare email with no @ and falls back to owner_id slice", () => {
    expect(
      pickDisplayLabel({
        displayName: null,
        email: "no-at-sign",
        ownerId,
        sub,
      }),
    ).toBe("6bd31b87");
  });

  it("prefers display_name over email local part", () => {
    expect(
      pickDisplayLabel({
        displayName: "Display Name",
        email: "local@example.com",
        ownerId,
        sub,
      }),
    ).toBe("Display Name");
  });
});

describe("emailLocalPart", () => {
  it("returns the local part for a normal email", () => {
    expect(emailLocalPart("john@example.com")).toBe("john");
  });

  it("returns null for null", () => {
    expect(emailLocalPart(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(emailLocalPart(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(emailLocalPart("")).toBeNull();
  });

  it("returns null when local part is empty", () => {
    expect(emailLocalPart("@example.com")).toBeNull();
  });

  it("returns null when no @ sign is present", () => {
    expect(emailLocalPart("no-at-sign")).toBeNull();
  });

  it("trims whitespace around the local part", () => {
    expect(emailLocalPart("  alice  @example.com")).toBe("alice");
  });

  it("handles email with multiple @ signs (uses first)", () => {
    expect(emailLocalPart("weird@foo@example.com")).toBe("weird");
  });
});
