import { TileId } from "@/lib/domain/ids";
import type { DoneRule, ObjectiveMode, SemanticRole, Tile, TileLifecycle } from "@/lib/domain/tile";
import { DONE_RULE, OBJECTIVE_MODE, TILE_LIFECYCLE } from "@/lib/domain/tile-list-view-constants";
import type { TileListView } from "@/lib/hooks/use-tile-list";

const LIFECYCLE_BY_CODE: Record<number, TileLifecycle> = {
  [TILE_LIFECYCLE.READY]: "ready",
  [TILE_LIFECYCLE.STARTED]: "started",
  [TILE_LIFECYCLE.DONE]: "done",
  [TILE_LIFECYCLE.CLOSED]: "closed",
};

const OBJECTIVE_MODE_BY_CODE: Record<number, ObjectiveMode> = {
  [OBJECTIVE_MODE.FINISH_ONCE]: "finish_once",
  [OBJECTIVE_MODE.RECURRING]: "recurring",
  [OBJECTIVE_MODE.MAXIMIZE_WITHIN_INTERVAL]: "maximize_within_interval",
  [OBJECTIVE_MODE.LABEL_ONLY]: "label_only",
};

const DONE_RULE_BY_CODE: Record<number, DoneRule> = {
  [DONE_RULE.MANUAL]: "manual",
  [DONE_RULE.TIME_REACHED]: "time_reached",
  [DONE_RULE.INTERVAL_END]: "interval_end",
};

function resolveLifecycle(code: number): TileLifecycle {
  return LIFECYCLE_BY_CODE[code] ?? "ready";
}

function resolveObjectiveMode(code: number): ObjectiveMode {
  return OBJECTIVE_MODE_BY_CODE[code] ?? "finish_once";
}

function resolveDoneRule(code: number | null): DoneRule | null {
  if (code === null || code === undefined) return null;
  return DONE_RULE_BY_CODE[code] ?? null;
}

/**
 * v1/10 §9 forbids a "is this a break?" discriminator; `semantic_role` was
 * removed from the wire. We project a UI-only label from `objective_mode`
 * purely for downstream presentation (chips, badge styling).
 */
function projectSemanticRole(objectiveMode: ObjectiveMode): SemanticRole {
  return objectiveMode === "label_only" ? "label" : "work";
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapListViewToTile(item: TileListView): Tile {
  const objectiveMode = resolveObjectiveMode(item.objective_mode);
  const lifecycle = resolveLifecycle(item.lifecycle);

  return {
    core: {
      id: TileId.fromString(item.id),
      title: item.title,
      nextAction: item.next_action,
      doneDefinition: item.done_definition,
      // Lifecycle drives these derived fields; the v1 wire no longer carries
      // explicit startedAt/completedAt, so we project from the temporal anchor
      // (active_start == STARTED, active_end == DONE).
      startedAt: parseDate(item.temporal?.active_start),
      completedAt: parseDate(item.temporal?.active_end),
      lifecycle,
    },
    work: {
      segments: [],
    },
    temporal: {
      tz: null,
      releaseAt: parseDate(item.temporal?.release_at),
      dueAt: parseDate(item.temporal?.due_at),
      fixedStart: parseDate(item.temporal?.fixed_start),
      fixedEnd: parseDate(item.temporal?.fixed_end),
      activeStart: parseDate(item.temporal?.active_start),
      activeEnd: parseDate(item.temporal?.active_end),
    },
    objective: {
      objectiveMode,
      targetWorkMin: item.target_work_min,
      targetRestMin: item.target_rest_min,
      doneRule: resolveDoneRule(item.done_rule),
      recurrence: item.recurrence
        ? {
            generator: {
              kind: "time_based" as const,
              step_min: item.recurrence.step_min,
              anchor_epoch_min: null,
            },
            window: {
              weekday_mask: 0,
              start_offset_min: item.recurrence.window_start_min,
              end_offset_min: item.recurrence.window_end_min,
              exclusions: [],
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
      semanticRole: projectSemanticRole(objectiveMode),
      labels: item.labels ?? [],
      timedLabels: [],
    },
  };
}
