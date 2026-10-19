import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CORE_IAM_HEADER,
  coreIamAudience,
  coreIamHeaders,
  resetCoreIamTokenCacheForTest,
} from "./core-iam-token";

const AUDIENCE = "https://core-api-abc-an.a.run.app";
const ENV = { TASTILE_CORE_IAM_AUDIENCE: AUDIENCE };

function idToken(exp: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode({ aud: AUDIENCE, exp })}.signature`;
}

function metadataReturning(...tokens: string[]) {
  const fetchImpl = vi.fn(async () => new Response(tokens.shift() ?? "", { status: 200 }));
  return fetchImpl;
}

describe("coreIamHeaders", () => {
  beforeEach(() => resetCoreIamTokenCacheForTest());

  it("adds nothing and makes no request when the audience is unset", async () => {
    const fetchImpl = metadataReturning();
    await expect(coreIamHeaders({}, fetchImpl, 1_000)).resolves.toEqual({});
    await expect(coreIamHeaders({ TASTILE_CORE_IAM_AUDIENCE: "  " }, fetchImpl, 1_000)).resolves.toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests an ID token for the service audience from the metadata server", async () => {
    const fetchImpl = metadataReturning(idToken(5_000));
    const headers = await coreIamHeaders(ENV, fetchImpl, 1_000);

    expect(headers).toEqual({ [CORE_IAM_HEADER]: `Bearer ${idToken(5_000)}` });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
        `?audience=${encodeURIComponent(AUDIENCE)}`,
    );
    expect(init.headers).toEqual({ "Metadata-Flavor": "Google" });
    expect(init.redirect).toBe("error");
  });

  it("reuses the token until five minutes before expiry, then refreshes", async () => {
    const fetchImpl = metadataReturning(idToken(5_000), idToken(9_000));
    await coreIamHeaders(ENV, fetchImpl, 1_000);
    await coreIamHeaders(ENV, fetchImpl, 4_699);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const refreshed = await coreIamHeaders(ENV, fetchImpl, 4_700);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(refreshed[CORE_IAM_HEADER]).toBe(`Bearer ${idToken(9_000)}`);
  });

  it("fails closed when the metadata server rejects the request", async () => {
    const fetchImpl = vi.fn(async () => new Response("denied", { status: 403 }));
    await expect(coreIamHeaders(ENV, fetchImpl, 1_000)).rejects.toThrow("HTTP 403");
  });

  it("rejects a response that is not a JWT with an expiry", async () => {
    await expect(coreIamHeaders(ENV, metadataReturning("not-a-token"), 1_000)).rejects.toThrow("not a JWT");
  });
});

describe("coreIamAudience", () => {
  it("accepts only an https service origin", () => {
    expect(coreIamAudience(ENV)).toBe(AUDIENCE);
    expect(coreIamAudience({ TASTILE_CORE_IAM_AUDIENCE: `${AUDIENCE}/` })).toBe(AUDIENCE);
    expect(() => coreIamAudience({ TASTILE_CORE_IAM_AUDIENCE: "http://core.internal" })).toThrow();
    expect(() => coreIamAudience({ TASTILE_CORE_IAM_AUDIENCE: `${AUDIENCE}/v1` })).toThrow();
    expect(() => coreIamAudience({ TASTILE_CORE_IAM_AUDIENCE: `${AUDIENCE}?x=1` })).toThrow();
  });
});

describe("coreIamHeaders edge assertion", () => {
  beforeEach(() => resetCoreIamTokenCacheForTest());

  it("adds the edge assertion when configured, with or without IAM", async () => {
    const fetchImpl = metadataReturning(idToken(5_000));
    await expect(
      coreIamHeaders({ TASTILE_EDGE_ASSERTION: "edge-1" }, fetchImpl, 1_000),
    ).resolves.toEqual({ "x-tastile-edge-assertion": "edge-1" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const both = await coreIamHeaders(
      { ...ENV, TASTILE_EDGE_ASSERTION: " edge-2 " },
      metadataReturning(idToken(5_000)),
      1_000,
    );
    expect(both).toEqual({
      [CORE_IAM_HEADER]: `Bearer ${idToken(5_000)}`,
      "x-tastile-edge-assertion": "edge-2",
    });
  });

  it("adds nothing for an empty edge assertion", async () => {
    await expect(
      coreIamHeaders({ TASTILE_EDGE_ASSERTION: "  " }, metadataReturning(), 1_000),
    ).resolves.toEqual({});
  });
});
