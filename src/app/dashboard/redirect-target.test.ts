import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_TARGET,
  REDIRECTABLE_PREFIXES,
  decideRedirectTarget,
  isRedirectable,
} from "./redirect-target";

describe("isRedirectable", () => {
  it.each(REDIRECTABLE_PREFIXES)("accepts exact prefix %s", (prefix) => {
    expect(isRedirectable(prefix)).toBe(true);
  });

  it("accepts /dashboard/timeline/<view> sub-routes", () => {
    expect(isRedirectable("/dashboard/timeline/month")).toBe(true);
    expect(isRedirectable("/dashboard/timeline/day")).toBe(true);
    expect(isRedirectable("/dashboard/timeline/week")).toBe(true);
  });

  it("rejects /dashboard (the redirect source itself)", () => {
    expect(isRedirectable("/dashboard")).toBe(false);
  });

  it("rejects empty / null / undefined", () => {
    expect(isRedirectable("")).toBe(false);
    expect(isRedirectable(null)).toBe(false);
    expect(isRedirectable(undefined)).toBe(false);
  });

  it("rejects unknown dashboard sub-routes", () => {
    expect(isRedirectable("/dashboard/foo")).toBe(false);
    expect(isRedirectable("/dashboard/preferences/something")).toBe(false);
  });

  it("rejects paths that share a prefix but are outside the allow-list", () => {
    // /dashboard/timeline-foo would falsely match `/dashboard/timeline` if we
    // only used startsWith without a separator boundary.
    expect(isRedirectable("/dashboard/timeline-foo")).toBe(false);
  });
});

describe("decideRedirectTarget", () => {
  it("defaults to Month when no prior visit", () => {
    expect(decideRedirectTarget(null)).toBe(DEFAULT_DASHBOARD_TARGET);
  });

  it("defaults to Month when /dashboard itself is stored", () => {
    expect(decideRedirectTarget("/dashboard")).toBe(DEFAULT_DASHBOARD_TARGET);
  });

  it("defaults to Month when stored path is invalid", () => {
    expect(decideRedirectTarget("/dashboard/random")).toBe(DEFAULT_DASHBOARD_TARGET);
  });

  it("restores the stored path when valid", () => {
    expect(decideRedirectTarget("/dashboard/tasks")).toBe("/dashboard/tasks");
    expect(decideRedirectTarget("/dashboard/projects")).toBe("/dashboard/projects");
    expect(decideRedirectTarget("/dashboard/preferences/general")).toBe(
      "/dashboard/preferences/general",
    );
  });

  it("preserves the timeline sub-route (e.g. /dashboard/timeline/month)", () => {
    expect(decideRedirectTarget("/dashboard/timeline/month")).toBe(
      "/dashboard/timeline/month",
    );
  });
});
