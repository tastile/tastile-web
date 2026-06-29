import { describe, expect, it } from "vitest";
import type { TimelineItem } from "./timeline-item";

const sample: TimelineItem = {
  placement_id: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  content: { title: "Write plan", description: null },
  visual: { color: "#5e6ad2", icon: "check" },
  role: 0,
  span: { start: "2026-06-29T08:00:00Z", end: "2026-06-29T09:00:00Z" },
  inside: null,
  source: { kind: 0, detail: null },
  resolution: { state: 0, resolved_at: "2026-06-29T07:00:00Z", resolution_hash: "h", violations: [] },
};

describe("TimelineItem", () => {
  it("accepts minimal executable placement", () => {
    expect(sample.role).toBe(0);
    expect(sample.span.start).toBe("2026-06-29T08:00:00Z");
  });
});
