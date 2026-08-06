import { describe, expect, it } from "vitest";
import { serializeTimeRequirement } from "./time-requirement";
import type { TimeRequirement } from "@/tile/model/v1/completion";

describe("serializeTimeRequirement", () => {
  const baseReq: TimeRequirement = {
    id: "tr_0190000000000000",
    observation: { scope: 0, source: 0, aggregate: 0, quantifier: 0 },
    required: { minMs: 1800000, maxMs: 5400000 },
    preferred: null,
  };

  it("serializes required range with null preferred", () => {
    const wire = serializeTimeRequirement(baseReq) as Record<string, unknown>;
    expect(wire.required).toEqual({ min: 1800000, max: 5400000 });
    expect(wire.preferred).toBeNull();
  });

  it("serializes preferred range when present", () => {
    const req = { ...baseReq, preferred: { minMs: 2400000, maxMs: 3600000 } };
    const wire = serializeTimeRequirement(req) as Record<string, unknown>;
    expect(wire.preferred).toEqual({ min: 2400000, max: 3600000 });
  });

  it("serializes observation fields", () => {
    const wire = serializeTimeRequirement(baseReq) as Record<string, unknown>;
    const obs = wire.observation as Record<string, unknown>;
    expect(obs.scope).toBe(0);
    expect(obs.source).toBe(0);
    expect(obs.aggregate).toBe(0);
    expect(obs.quantifier).toBe(0);
  });

  it("serializes observation with null quantifier", () => {
    const req = {
      ...baseReq,
      observation: { ...baseReq.observation, quantifier: null },
    };
    const wire = serializeTimeRequirement(req) as Record<string, unknown>;
    const obs = wire.observation as Record<string, unknown>;
    expect(obs.quantifier).toBeNull();
  });

  it("round-trips through JSON", () => {
    const wire = serializeTimeRequirement(baseReq);
    const json = JSON.stringify(wire);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(wire);
  });

  it("handles preferred with null min or max", () => {
    const req = {
      ...baseReq,
      preferred: { minMs: null, maxMs: 3600000 },
    };
    const wire = serializeTimeRequirement(req) as Record<string, unknown>;
    expect(wire.preferred).toEqual({ min: null, max: 3600000 });
  });

  it("default {required: 30-90min} round-trip preserves duration", () => {
    const req: TimeRequirement = {
      id: "tr_default_test",
      observation: { scope: 1, source: 0, aggregate: 0, quantifier: 0 },
      required: { minMs: 30 * 60_000, maxMs: 90 * 60_000 },
      preferred: null,
    };
    const wire = serializeTimeRequirement(req) as Record<string, unknown>;
    const reqWire = wire.required as Record<string, unknown>;
    expect(reqWire.min).toBe(30 * 60_000);
    expect(reqWire.max).toBe(90 * 60_000);
    expect(wire.preferred).toBeNull();
  });

  it("EACH_DURATION with quantifier=ALL preserves quantifier", () => {
    const req: TimeRequirement = {
      id: "tr_each_test",
      observation: { scope: 1, source: 0, aggregate: 1, quantifier: 0 },
      required: { minMs: 1800000, maxMs: 1800000 },
      preferred: null,
    };
    const wire = serializeTimeRequirement(req) as Record<string, unknown>;
    const obs = wire.observation as Record<string, unknown>;
    expect(obs.aggregate).toBe(1);
    expect(obs.quantifier).toBe(0);
  });
});
