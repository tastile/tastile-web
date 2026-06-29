import { describe, expect, it } from "vitest";
import { PlanRole } from "./constants";
import type { TimelineItem } from "./timeline-item";

const sample: TimelineItem = {
  placement_id: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  content: { title: "Write plan", description: null },
  visual: { color: "#5e6ad2", icon: "check" },
  role: PlanRole.EXECUTABLE,
  span: { start: "2026-06-29T08:00:00Z", end: "2026-06-29T09:00:00Z" },
  inside: null,
  source: { kind: 0, detail: null },
  resolution: {
    state: 0,
    resolved_at: "2026-06-29T07:00:00Z",
    resolution_hash: "00000000-0000-0000-0000-000000000001",
    violations: [],
  },
};

describe("TimelineItem", () => {
  it("accepts minimal executable placement", () => {
    expect(sample.role).toBe(PlanRole.EXECUTABLE);
    expect(sample.span.start).toBe("2026-06-29T08:00:00Z");
  });
});