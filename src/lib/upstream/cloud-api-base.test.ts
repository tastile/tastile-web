import { afterEach, describe, expect, it } from "vitest";

import { getCloudApiBase } from "./cloud-api-base";

const originalEnvironment = process.env.TASTILE_ENV;
const originalCloudApiBase = process.env.CLOUD_API_BASE;
const originalRustApiUrl = process.env.TASTILE_RUST_API_URL;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.TASTILE_ENV;
  else process.env.TASTILE_ENV = originalEnvironment;
  if (originalCloudApiBase === undefined) delete process.env.CLOUD_API_BASE;
  else process.env.CLOUD_API_BASE = originalCloudApiBase;
  if (originalRustApiUrl === undefined) delete process.env.TASTILE_RUST_API_URL;
  else process.env.TASTILE_RUST_API_URL = originalRustApiUrl;
});

describe("Cloud API base security", () => {
  it("rejects a public HTTP upstream in a protected runtime", () => {
    process.env.TASTILE_ENV = "staging";
    process.env.CLOUD_API_BASE = "http://api.example.com";
    delete process.env.TASTILE_RUST_API_URL;

    expect(() => getCloudApiBase()).toThrow(/HTTPS/);
  });

  it("allows HTTP only for a local loopback upstream during development", () => {
    process.env.TASTILE_ENV = "development";
    process.env.CLOUD_API_BASE = "http://127.0.0.1:31400/";
    delete process.env.TASTILE_RUST_API_URL;

    expect(getCloudApiBase()).toBe("http://127.0.0.1:31400");
  });

  it("rejects public HTTP even when the runtime is local", () => {
    process.env.TASTILE_ENV = "development";
    process.env.CLOUD_API_BASE = "http://api.example.com";
    delete process.env.TASTILE_RUST_API_URL;

    expect(() => getCloudApiBase()).toThrow(/HTTPS/);
  });
});
