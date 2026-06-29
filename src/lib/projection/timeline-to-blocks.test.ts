import { describe, expect, it } from "vitest";
import { timelineResponseToBlocks } from "./timeline-to-blocks";
import type { TimelineItem } from "@/lib/domain/v1/timeline-item";
import { PlanRole, ResolutionState } from "@/lib/domain/v1/constants";

const item = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
  placement_id: "p1",
  revision: 1,
  content: { title: "x", description: null },
  visual: { color: null, icon: null },
  role: PlanRole.EXECUTABLE,
  span: { start: "2026-06-29T08:00:00Z", end: "2026-06-29T09:00:00Z" },
  inside: null,
  source: { kind: 0, detail: null },
  resolution: { state: ResolutionState.OPEN, resolved_at: "2026-06-29T07:00:00Z", resolution_hash: "h", violations: [] },
  ...overrides,
});

describe("timelineResponseToBlocks", () => {
  it("returns empty for empty input", () => {
    expect(timelineResponseToBlocks([])).toEqual({ blocks: [], allDaySpans: [] });
  });

  it("places timed placement (start and end on same date) in blocks", () => {
    const r = timelineResponseToBlocks([item()]);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]?.tile_id).toBe("p1");
    expect(r.blocks[0]?.title).toBe("x");
    expect(r.allDaySpans).toHaveLength(0);
    expect(r.blocks[0]?.all_day).toBe(false);
  });

  it("places label role (PlanRole.LABEL) in allDaySpans", () => {
    const r = timelineResponseToBlocks([item({ role: PlanRole.LABEL })]);
    expect(r.blocks).toHaveLength(0);
    expect(r.allDaySpans).toHaveLength(1);
    expect(r.allDaySpans[0]?.semantic_role).toBe("label");
  });

  it("places multi-day placement in allDaySpans", () => {
    const r = timelineResponseToBlocks([
      item({ span: { start: "2026-06-29T20:00:00Z", end: "2026-06-30T02:00:00Z" } }),
    ]);
    expect(r.allDaySpans).toHaveLength(1);
    expect(r.blocks).toHaveLength(0);
  });

  it("marks active state (ResolutionState.OPEN) as is_active true", () => {
    const r = timelineResponseToBlocks([item()]);
    expect(r.blocks[0]?.is_active).toBe(true);
  });

  it("marks blocked state (ResolutionState.BLOCKED) with violations as is_active false and source synthetic", () => {
    const r = timelineResponseToBlocks([item({
      resolution: {
        state: ResolutionState.BLOCKED,
        resolved_at: "2026-06-29T07:00:00Z",
        resolution_hash: "h",
        violations: [{ kind: 6, message: "CONFLICT", current_revision: null }],
      },
    })]);
    expect(r.blocks[0]?.is_active).toBe(false);
    expect(r.blocks[0]?.ownership).toBe("synthetic");
  });

  it("marks closed state (ResolutionState.CLOSED) as is_active false with tastile_owned ownership", () => {
    const r = timelineResponseToBlocks([item({
      resolution: {
        state: ResolutionState.CLOSED,
        resolved_at: "2026-06-29T07:00:00Z",
        resolution_hash: "h",
        violations: [],
      },
    })]);
    expect(r.blocks[0]?.is_active).toBe(false);
    expect(r.blocks[0]?.ownership).toBe("tastile_owned");
  });

  it("places multi-day executable (EXECUTABLE) placement in allDaySpans with work semantic_role", () => {
    const r = timelineResponseToBlocks([
      item({
        role: PlanRole.EXECUTABLE,
        span: { start: "2026-06-29T20:00:00Z", end: "2026-06-30T02:00:00Z" },
      }),
    ]);
    expect(r.allDaySpans).toHaveLength(1);
    expect(r.blocks).toHaveLength(0);
    expect(r.allDaySpans[0]?.semantic_role).toBe("work");
  });

  it("marks EXECUTABLE blocks editable and LABEL spans not editable", () => {
    const r = timelineResponseToBlocks([
      item({ placement_id: "exec", role: PlanRole.EXECUTABLE }),
      item({ placement_id: "label", role: PlanRole.LABEL }),
    ]);
    expect(r.blocks[0]?.editable).toBe(true);
    expect(r.allDaySpans[0]?.editable).toBe(false);
  });
});