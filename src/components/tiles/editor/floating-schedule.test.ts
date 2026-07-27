import { describe, expect, it } from "vitest";

import { buildFloatingSchedulePayload, formatFloatingScheduleSummary } from "./floating-schedule";

describe("buildFloatingSchedulePayload", () => {
  it("creates a flexible aggregate with a time requirement and no placement baseline", () => {
    const payload = buildFloatingSchedulePayload({
      title: "Practice",
      requiredMinutes: 90,
      label: {
        placementId: "018f0000-0000-7000-8000-000000000001",
        title: "Term 1",
        start: "2026-04-01T00:00:00Z",
        end: "2026-07-31T23:59:59Z",
      },
    });

    expect(payload.plan.completion.time_requirements[0].required).toEqual({
      min: 5_400_000,
      max: null,
    });
    expect(payload.plan.completion.root).toEqual({
      Term: { Requirement: { time_requirement: expect.any(String), state: "Met" } },
    });
    expect(payload.windows).toEqual([
      {
        kind: 1,
        bounds: {
          start: "2026-04-01T00:00:00Z",
          end: "2026-07-31T23:59:59Z",
        },
        rules: [
          expect.objectContaining({
            holiday_kind: 2,
            label_placement: "018f0000-0000-7000-8000-000000000001",
            parent_placement: null,
          }),
        ],
      },
    ]);
    expect(payload.reference_targets[0].target).toEqual({
      Placement: "018f0000-0000-7000-8000-000000000001",
    });
    expect(payload.flows[0].candidates[0].when).toMatchObject({
      Term: {
        Gap: {
          scope: { kind: 0, parent: null, gap: null },
          size: null,
          left_anchor: {
            when: { Term: { Calendar: { weekday_mask: 0, holiday_kind: 2 } } },
            pick: { kind: 1, at: null },
          },
        },
      },
    });
    expect(payload).not.toHaveProperty("placement");
  });
});

describe("formatFloatingScheduleSummary", () => {
  it("describes an unresolved availability without exposing implementation names", () => {
    expect(formatFloatingScheduleSummary({ requiredMinutes: 60, label: null })).toEqual([
      "Required time: 60 min",
      "Available window: Not set",
    ]);
  });
});
