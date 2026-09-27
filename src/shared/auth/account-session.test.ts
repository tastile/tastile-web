import { afterEach, describe, expect, it } from "vitest";

import { getAccountOwnerId } from "./account-session";

const originalEnvironment = process.env.TASTILE_ENV;
const originalBypass = process.env.E2E_BYPASS_AUTH;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.TASTILE_ENV;
  else process.env.TASTILE_ENV = originalEnvironment;
  if (originalBypass === undefined) delete process.env.E2E_BYPASS_AUTH;
  else process.env.E2E_BYPASS_AUTH = originalBypass;
});

describe("account bridge identity", () => {
  it("derives the same UUIDv5 owner as tastile-core", async () => {
    process.env.TASTILE_ENV = "staging";
    process.env.E2E_BYPASS_AUTH = "0";

    await expect(
      getAccountOwnerId({ session: { id: "bridge-contract-test" } }),
    ).resolves.toBe("a2772101-2d4b-52d3-8b35-79e71c295400");
  });
});
