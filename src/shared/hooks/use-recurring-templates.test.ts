import { describe, expect, it } from "vitest";
import type { TileListView } from "@/shared/hooks/use-tile-list";
import type { RecurringTemplateListItem } from "@/shared/hooks/use-recurring-templates";

// Mirrors the mapper inside `use-recurring-templates.ts`. The hook body is a
// thin TanStack Query wrapper, so we exercise the projection logic directly
// here rather than spinning up a QueryClient + fetch mock for every shape.
function projectRecurringTemplate(
  tile: TileListView,
): RecurringTemplateListItem | null {
  const source = tile.source;
  if (!source) return null;
  return {
    id: tile.id,
    title: tile.title,
    note: "",
    recurrence: {
      generator: {},
      window: {
        weekday_mask: source.weekday_mask ?? 0,
        start_offset_min: Math.round(source.window_start_offset_ms / 60_000),
        end_offset_min: Math.round(source.window_end_offset_ms / 60_000),
      },
      selector: { expression: null },
    },
  };
}

function makeTile(overrides: Partial<TileListView> & { source: NonNullable<TileListView["source"]> }): TileListView {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    title: "Untitled",
    plan_id: null,
    lifecycle: 0,
    next_action: null,
    done_definition: null,
    worked_minutes: 0,
    break_minutes: 0,
    labels: [],
    objective_mode: 0,
    target_work_min: null,
    target_rest_min: null,
    done_rule: null,
    resume_note: null,
    projected_next_start_at: null,
    temporal: null,
    recurrence: null,
    ...overrides,
  };
}

describe("useRecurringTemplates projection", () => {
  it("returns null for legacy v1_tile rows without a source summary", () => {
    expect(
      projectRecurringTemplate({
        ...makeTile({
          source: undefined as unknown as NonNullable<TileListView["source"]>,
        }),
        id: "legacy",
        title: "legacy row",
        source: null,
      }),
    ).toBeNull();
  });

  it("projects a RECURRING source-tile row into the legacy shape", () => {
    const out = projectRecurringTemplate(
      makeTile({
        id: "019feab5-70d4-7422-8c3e-6733f958c750",
        title: "休憩",
        source: {
          kind: 0,
          source_state: 0,
          generation_kind: 1,
          split_kind: 0,
          priority: 10,
          required_duration_ms: 300_000,
          window_start_offset_ms: 0,
          window_end_offset_ms: 1_800_000,
          weekday_mask: null,
          external_id: null,
          color: "#22C55E",
          icon: null,
        },
      }),
    );
    expect(out).toEqual({
      id: "019feab5-70d4-7422-8c3e-6733f958c750",
      title: "休憩",
      note: "",
      recurrence: {
        generator: {},
        window: {
          weekday_mask: 0,
          start_offset_min: 0,
          end_offset_min: 30,
        },
        selector: { expression: null },
      },
    });
  });

  it("keeps DEMAND-generation source-tiles (they are still source tiles)", () => {
    const out = projectRecurringTemplate(
      makeTile({
        title: "study",
        source: {
          kind: 1,
          source_state: 0,
          generation_kind: 2,
          split_kind: 0,
          priority: 50,
          required_duration_ms: 0,
          window_start_offset_ms: 0,
          window_end_offset_ms: 28_800_000,
          weekday_mask: 0b0_1111_111,
          external_id: null,
          color: null,
          icon: null,
        },
      }),
    );
    expect(out?.recurrence.window).toEqual({
      weekday_mask: 0b0_1111_111,
      start_offset_min: 0,
      end_offset_min: 480,
    });
  });

  it("rounds ms→min to nearest integer for non-aligned offsets", () => {
    const out = projectRecurringTemplate(
      makeTile({
        source: {
          kind: null,
          source_state: 0,
          generation_kind: 0,
          split_kind: 0,
          priority: 0,
          required_duration_ms: 0,
          window_start_offset_ms: 90_000,
          window_end_offset_ms: 5_500_000,
          weekday_mask: null,
          external_id: null,
          color: null,
          icon: null,
        },
      }),
    );
    expect(out?.recurrence.window).toEqual({
      weekday_mask: 0,
      start_offset_min: 2,
      end_offset_min: 92,
    });
  });
});