import type {
  Condition,
  PublishScheduleDefinitionPayload,
  RequirementState,
} from "@/shared/api/v1/schedule-definition";
import { uuidv7 } from "@/tile/model/v1/envelope";

interface FloatingLabel {
  placementId: string;
  title: string;
  start: string;
  end: string;
}

export interface FloatingScheduleInput {
  title: string;
  requiredMinutes: number;
  label: FloatingLabel | null;
}

function gapEligibilityCondition(): Condition {
  const calendar = {
    weekday_mask: 0,
    time_start: null,
    time_end: null,
    holiday_kind: 2,
    date_range: null,
    offset_min: 0,
  };
  const anchor = {
    when: { Term: { Calendar: calendar } },
    pick: { kind: 1, at: null },
  };
  return {
    Term: {
      Gap: {
        scope: { kind: 0, parent: null, gap: null },
        left_anchor: anchor,
        right_anchor: anchor,
        size: null,
      },
    },
  };
}

/**
 * JSON contract for the Rust PublishScheduleDefinition command.
 * Names and externally-tagged enum values deliberately match serde defaults.
 */
export function buildFloatingSchedulePayload(
  input: FloatingScheduleInput,
): PublishScheduleDefinitionPayload {
  if (!input.label) throw new Error("availability label is required");
  const requiredMs = input.requiredMinutes * 60_000;
  const requirementId = uuidv7();
  const referenceId = uuidv7();
  const windowRuleId = uuidv7();
  const requirementState: RequirementState = "Met";
  const eligibleGap = gapEligibilityCondition();

  return {
    tile: {
      title: input.title.trim(),
      description: null,
      color: null,
      icon: null,
      external_id: null,
    },
    plan: {
      role: 0,
      references: [{ id: referenceId, target: 0, pick: { kind: 0, at: null }, when: null }],
      completion: {
        root: {
          Term: {
            Requirement: { time_requirement: requirementId, state: requirementState },
          },
        },
        time_requirements: [
          {
            id: requirementId,
            observation: {
              scope: 0,
              source: 0,
              aggregate: 0,
              quantifier: null,
              reference: null,
            },
            required: { min: requiredMs, max: null },
            preferred: null,
          },
        ],
        tasks: [],
      },
      planning: { placement_rules: [], nesting_rules: [] },
      metrics: [],
      decisions: [],
    },
    reference_targets: [
      {
        source_reference_id: referenceId,
        target: { Placement: input.label.placementId },
      },
    ],
    windows: [
      {
        kind: 1,
        bounds: { start: input.label.start, end: input.label.end },
        rules: [
          {
            id: windowRuleId,
            weekday_mask: null,
            time_start_min: null,
            time_end_min: null,
            holiday_kind: 2,
            date_range: null,
            offset_min: 0,
            label_placement: input.label.placementId,
            parent_placement: null,
            gap_left_condition_id: null,
            gap_right_condition_id: null,
            gap_size: null,
          },
        ],
      },
    ],
    recurrence: null,
    flows: [
      {
        observes: ["FactChanged"],
        when: null,
        candidates: [
          {
            when: eligibleGap,
            rank: 0,
            outputs: [
              {
                ProposeNewPlanPlacement: {
                  span: { start: input.label.start, end: input.label.end },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export function formatFloatingScheduleSummary(
  input: Pick<FloatingScheduleInput, "requiredMinutes" | "label">,
) {
  return [
    `Required time: ${input.requiredMinutes} min`,
    `Available window: ${input.label?.title ?? "Not set"}`,
  ];
}
