import { describe, expect, it } from "vitest";

import { hasValidEdgeAssertion } from "./edge-assertion";

const ENV = { TASTILE_EDGE_ASSERTION: "edge-value-123" };

describe("hasValidEdgeAssertion", () => {
  it("allows every request when no edge assertion is configured", () => {
    expect(hasValidEdgeAssertion(null, {})).toBe(true);
    expect(hasValidEdgeAssertion("anything", { TASTILE_EDGE_ASSERTION: "  " })).toBe(true);
  });

  it("accepts only the exact configured value", () => {
    expect(hasValidEdgeAssertion("edge-value-123", ENV)).toBe(true);
  });

  it("rejects a missing, empty, different, prefixed, or extended value", () => {
    expect(hasValidEdgeAssertion(null, ENV)).toBe(false);
    expect(hasValidEdgeAssertion("", ENV)).toBe(false);
    expect(hasValidEdgeAssertion("edge-value-124", ENV)).toBe(false);
    expect(hasValidEdgeAssertion("edge-value-12", ENV)).toBe(false);
    expect(hasValidEdgeAssertion("edge-value-1234", ENV)).toBe(false);
  });
});
