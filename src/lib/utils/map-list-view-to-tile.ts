import { TileId } from "@/lib/domain/ids";
import type { Tile, ObjectiveMode, DoneRule, SemanticRole } from "@/lib/domain/tile";
import type { TileListView } from "@/lib/hooks/use-tile-list";

export function mapListViewToTile(item: TileListView): Tile {
  return {
    core: {
      id: TileId.fromString(item.id),
      title: item.title,
      nextAction: item.next_action,
      doneDefinition: item.done_definition,
      startedAt: item.temporal?.active_start ? new Date(item.temporal.active_start) : null,
      completedAt: item.temporal?.active_end ? new Date(item.temporal.active_end) : null,
    },
    work: {
      segments: [],
    },
    temporal: {
      tz: null,
      releaseAt: item.temporal?.release_at ? new Date(item.temporal.release_at) : null,
      dueAt: item.temporal?.due_at ? new Date(item.temporal.due_at) : null,
      fixedStart: item.temporal?.fixed_start ? new Date(item.temporal.fixed_start) : null,
      fixedEnd: item.temporal?.fixed_end ? new Date(item.temporal.fixed_end) : null,
      activeStart: item.temporal?.active_start ? new Date(item.temporal.active_start) : null,
      activeEnd: item.temporal?.active_end ? new Date(item.temporal.active_end) : null,
    },
    objective: {
      objectiveMode: (item.objective_mode as ObjectiveMode) ?? "finish_once",
      targetWorkMin: item.target_work_min,
      targetRestMin: item.target_rest_min,
      doneRule: (item.done_rule as DoneRule) ?? "manual",
      recurrence: item.recurrence
        ? {
            generator: {
              stepMin: item.recurrence.step_min,
              anchorEpochMin: null,
            },
            window: {
              startOffsetMin: item.recurrence.window_start_min,
              endOffsetMin: item.recurrence.window_end_min,
            },
            selector: {
              expression: item.recurrence.expression,
            },
          }
        : null,
    },
    interruption: {
      interruptPenalty: 0,
      resumePenalty: 0,
      breakSplitsWork: false,
      externalInterruptOnly: false,
    },
    automation: {
      promptOnStart: false,
      promptOnEnd: false,
      autoStartAllowed: false,
      autoEndAllowed: false,
    },
    annotation: {
      semanticRole: (item.semantic_role as SemanticRole) ?? "work",
      labels: item.labels ?? [],
      timedLabels: [],
    },
  };
}
