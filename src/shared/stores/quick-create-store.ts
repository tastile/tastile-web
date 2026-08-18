/**
 * QuickCreateStore — single source of truth for the QuickCreate form.
 *
 * Sections mirror the v1 spec (v1/02, v1/03, v1/04, v1/05, v1/08, v1/13):
 *   §1 Identity   — Tile.Base (title, kind, visual, externalId)
 *   §2 Plan       — Plan.role, completion, planning, metrics, decisions, references
 *   §3 Time       — Span, DurationRange
 *   §4 Windows    — Window[] (first-class per v1/03)
 *   §5 Recurring  — life, frameRules[], rules[] (only when identity.kind = RECURRING)
 *   §6 Advanced   — changeSets[], rules[] (ChangeSet layer per v1/04)
 *   §7 Meta       — project, tags, memo
 *
 * The store is the single source of truth for all v1 form fields. The
 * submit flow (`@/shared/api/v1/submit`) reads this store directly to build
 * the v1 envelope sequence — there is no v7-shaped intermediate form state.
 *
 * Slice naming follows the v1 spec section that owns the data, not the
 * UI section that displays it. `frameRules` is intentionally distinct
 * from `frames` on the v1 `Recurring` aggregate: the form edits input
 * `FrameRule[]` (what the worker materializes from), while the
 * aggregate stores materialized `Frame[]` (worker output).
 */

import type { WorkflowKind } from "@/features/create-tile/model/workflow-config";
import { type SubPanelKey } from "@/features/create-tile/ui/SubPanelShell";
import type { Stamp } from "@/shared/model/v1/actor";
import type { ChangeRule } from "@/shared/model/v1/change-set";
import type { TaskDefinition, TimeRequirement } from "@/shared/model/v1/completion";
import {
  ConditionKind,
  PlanRole,
  RecurringState,
  type RecurringStateValue,
  TaskOrderRelation,
  TileKind,
  type TileKindValue,
} from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { FrameRule, Plan, RecurringRule } from "@/shared/model/v1/tile-types";
import type { DateRange, DurationRange, Span, Window } from "@/shared/model/v1/window";
import type { RecurrenceModel } from "@/tile/model/types";
import { create } from "zustand";

/**
 * Structural shape of a starter template row's `recurrence` field as
 * emitted by the proxy's `toRecurringTemplateList` (open-struct, no
 * `kind` discriminator on `generator`). The store only round-trips
 * this through to the form as a seed — Submit reconstructs the v1
 * FrameRule body from form fields, so we do not constrain this to the
 * strict `RecurrenceModel` discriminated union.
 */
interface RecurrenceTemplateRecurrence {
  generator: {
    focus_block_based?: { phases: Array<{ focus_min: number; break_min: number }> };
    step_min?: number;
  };
  // react-doctor-disable-next-line react-doctor/no-unguarded-browser-global-at-module-scope
  window: {
    weekday_mask: number;
    start_offset_min: number;
    end_offset_min: number;
  };
  selector: {
    expression: unknown | null;
  };
}

export type RepeatChoice = "once" | "daily" | "weekly" | "monthly" | "interval" | "condition";

// ---------- slice types ----------

export interface TileIdentitySlice {
  kind: TileKindValue;
  title: string;
  description: string | null;
  externalId: string | null;
  visual: { color: string; icon: string };
}

export type WhenMode = "none" | "day" | "range" | "reference";
export type TimeOfDayMode = "all-day" | "range" | "unspecified";

/**
 * Top-level split policy attached to the time slice. Mirrors the
 * source-authoring `splitPolicy.kind` shape but is kept flat here so the
 * Task form can toggle it without writing through the SourceAuthoring
 * surface. `"unsplit"` is the conservative default; `"split"` allows the
 * scheduler to break the required duration into multiple segments.
 *
 * NOTE: this field is wired UI-only for the QuickCreateTask panel —
 * Submit does not yet emit a command that carries this flag. Wire-up
 * is tracked as a follow-up so the submit path keeps producing the
 * same v1 envelope as before this UX reorder.
 */
type TimeSplitPolicy = "unsplit" | "split";

/**
 * Three-pattern time model that drives the Recurring form's time row
 * (and the v1 wire's `schedule_kind`). Each variant maps to a distinct
 * authoring shape:
 *
 *   - `"duration_only"`       — only a per-instance duration, no fixed time
 *   - `"fixed_window"`        — start + end time-of-day, no duration requirement
 *   - `"window_with_duration"`— schedulable window + duration to place inside
 *
 * The Recurring form keeps this in sync with the legacy
 * `timeOfDayMode` / `timeOfDayStart` / `timeOfDayEnd` / `durationMinMax`
 * fields so the wire builders for the other workflows (Event, Task,
 * Detailed) keep working unchanged.
 */
type TimeModel =
  | "duration_only"
  | "fixed_window"
  | "window_with_duration";

export interface TimeSlice {
  /** Primary switch that drives the Recurring form's time row + wire schedule_kind. */
  timeModel: TimeModel;
  /**
   * Schedulable window for `"window_with_duration"` — the time-of-day
   * range inside which the placement worker may fit the required
   * duration. HH:MM strings (matches the legacy `timeOfDayStart/End`
   * shape so the UI can reuse `TimeSuggestionInput`).
   */
  schedulableWindow: { start: string; end: string };
  span: Span;
  durationMinMax: DurationRange;
  whenMode: WhenMode;
  // LEGACY — kept because the Event / Task / Detailed forms still
  // author through these. The Recurring form mirrors writes here so
  // cross-workflow wire builders stay green. Prefer `timeModel` +
  // `schedulableWindow` for new Recurring-only logic.
  timeOfDayMode: TimeOfDayMode;
  timeOfDayStart: string;
  timeOfDayEnd: string;
  referenceId: string | null;
  referenceLabel: string;
  splitPolicy: TimeSplitPolicy;
}

/**
 * Recurring form input. Tracks `frameRules[]` (input to materialization)
 * and `rules[]` (output rules); not the materialized `Frame[]` on the
 * aggregate. See file header for the frames vs. frameRules distinction.
 */
export interface RecurringSlice {
  life: {
    active: DateRange;
    state: RecurringStateValue;
    changed: Stamp;
  };
  frameRules: FrameRule[];
  rules: RecurringRule[];
  repeatMode: RepeatChoice;
  weekdayMask: number;
  endDate: string;
  intervalValue: number;
  intervalUnit: "min" | "hour" | "day";
  /** Condition tree evaluated when repeatMode === "condition". */
  condition: import("@/shared/model/v1/condition").ConditionNode | null;
  /** Set to true when recurring.condition was non-null but silently dropped by wire */
  conditionIgnored: boolean;
  /**
   * Monthly pattern switch. The user picks ONE pattern per form
   * submission (not both) — the other is dropped to `null` so the
   * wire emits a clean tagged union on `monthly_rule`.
   *
   * - `"by_day"`     → `monthlyDayOfMonth` (1-31)
   * - `"by_weekday"` → `monthlyWeekOfMonth` (1-5, where 5 = "last") + `monthlyWeekday` (0-6)
   * - `null`         → no Monthly pattern authored yet
   */
  monthlyKind: "by_day" | "by_weekday" | null;
  /** 1-31. Only meaningful when `monthlyKind === "by_day"`. */
  monthlyDayOfMonth: number | null;
  /** 1-5 (5 is the alias for "last" week of the month). Only meaningful when `monthlyKind === "by_weekday"`. */
  monthlyWeekOfMonth: number | null;
  /** 0-6 (Mon..Sun). Stored as a single-bit mirror on `weekdayMask` for weekly reuse. */
  monthlyWeekday: number | null;
}

interface AdvancedSlice {
  changeSets: ChangeRule[];
  rules: ChangeRule[];
}

export interface SourceRelationDraft {
  id: string;
  referencedSourceTileId: string;
  referencedTitle: string;
  kind: number;
  point: number;
  offsetMs: number;
  ordering: { primary: number; point: number; direction: number };
  durationKind: "subject" | "reference" | "fixed";
  fixedDurationMs: number | null;
  splitPolicy: {
    kind: "unsplit" | "split";
    requiredTotalDurationMs: number;
    minSegmentMs: number | null;
    maxSegmentMs: number | null;
  };
  correlationScope: number;
  lifecycleFilter: number;
  eligibleThroughRevision: number;
  summaryPriority: number;
}

export interface SourceAuthoringSlice {
  offsetMin: number;
  excludedDates: string[];
  preferredDurationMinMax: DurationRange;
  splitPolicy: {
    kind: 0 | 1 | 2;
    minSegmentMs: number | null;
    maxSegmentMs: number | null;
    maxSegments: number | null;
  };
  priority: number;
  include: "INCLUDED" | "EXCLUDED";
  anchorMode: "FIXED" | "FLOATING";
  relations: SourceRelationDraft[];
  flowSequences: Array<{
    id: string;
    observes: Array<
      | "PlacementCreated"
      | "PlacementUpdated"
      | "PlacementClosed"
      | "ExecutionStarted"
      | "ExecutionFinished"
      | "FactChanged"
      | "MetricChanged"
    >;
    when: import("@/shared/model/v1/condition").ConditionNode | null;
    candidateWhen: import("@/shared/model/v1/condition").ConditionNode | null;
    minimumGapMs: number;
    rank: number;
    /** Whether to wrap back to the first step after the final one (generic cyclic flow). */
    cycle: boolean;
    /** Whether to reset the step cursor to the start whenever an interrupt fires. */
    resetOnInterrupt: boolean;
    steps: Array<{ id: string; waitBeforeMs: number; emitDurationMs: number }>;
  }>;
}

export interface MetaSlice {
  ownerSubjectId: string | null;
  memo: string;
  /** Backwards-compat: `true` mirrors `plan.role = LABEL`. Set via setLabelOnly. */
  isLabelOnly: boolean;
}

// ---------- store ----------

type QuickCreateMode = "create" | "edit";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; reason: string; message: string }
  | { kind: "success" };

/**
 * Shape of a starter Recurring template row as produced by the proxy's
 * `toRecurringTemplateList` (see `proxy/[...path]/route.ts`). The id
 * MUST be a server-resolvable UUIDv7 — the proxy no longer fabricates
 * placeholder rows (the legacy `default-break-recurring` string was
 * removed 2026-07-07). Only the title / note / recurrence are
 * load-bearing for create-from-template flows. `recurrence` is optional
 * because the proxy passes through whatever the v1 source provides;
 * Submit rebuilds the FrameRule body from form fields regardless.
 */
interface RecurringTemplateShape {
  id: string;
  title: string;
  note: string;
  recurrence?: RecurrenceTemplateRecurrence;
}

export interface QuickCreateState {
  isOpen: boolean;
  mode: QuickCreateMode;
  editingId: string | null;
  /**
   * The v1 tile id backing the placement currently being edited.
   * Required because /v1/tiles/{id}/update mutates the tile while
   * /v1/placements/{id}/changes mutates the placement; both must run
   * when the user edits a placement.
   */
  editingTileId: string | null;
  /**
   * Non-null when `loadFromRecurringTile` could not fetch the tile (e.g.
   * the recurring-tile GET returned 404 because the template does not
   * exist in the backing store). The panel surfaces this as a banner so
   * the user sees why hydration failed instead of a silent no-op. Cleared
   * on the next successful load.
   */
  loadError: string | null;
  /**
   * When true, QuickCreate's Submit is gated so the user cannot
   * fire an UPDATE_TILE / UPDATE_PLACEMENT against a tile whose
   * current state we could not confirm. Set by
   * `loadFromRecurringTile` when `/v1/tiles/{id}` returns a non-OK
   * response, because we may be looking at a stale or phantom tile
   * and Submit must not silently PATCH a record that does not exist
   * (see plan docs/plans/2026-07-04-tile-panel-create-flow.md §B
   * refinement). Cleared on the next successful load or by `reset`.
   */
  submitBlocked: boolean;
  /**
   * When opening create, the panel uses this as the initial allDay
   * toggle. The slot-click flow sets this to false so the user sees
   * the slot time; the sidebar + button leaves it at true.
   */
  initialAllDay: boolean;
  /**
   * The use-case-specialized workflow this QuickCreate instance is
   * rendering. `null` means the picker menu is open and no workflow
   * has been chosen yet (ActivityBar + entry point). Switching
   * workflows preserves all field data because the underlying schema
   * is shared — only the rendered form swaps.
   */
  workflowKind: WorkflowKind | null;
  /**
   * Which sub-panel is currently active. "base" means the main body
   * is shown. QuickCreatePanel reads this to shift the panel left
   * when a sub-panel is open.
   */
  activePanel: SubPanelKey;
  setActivePanel: (panel: SubPanelKey) => void;
  /**
   * When true, the dashboard mounts the legacy monolithic `QuickCreate`
   * editor instead of the specialized `QuickCreatePanel`. Both stay
   * mounted so the user can toggle without losing the active draft —
   * see feedback_keep_original_workflow.md for the user-facing
   * requirement that the original workflow never be removed.
   */
  useLegacyEditor: boolean;
  open: () => void;
  openCreate: (options?: {
    initialAllDay?: boolean;
    workflow?: WorkflowKind;
  }) => void;
  openEdit: (
    eventId: string,
    tileId?: string | null,
    workflow?: WorkflowKind,
  ) => void;
  close: () => void;
  toggle: () => void;
  /**
   * Switch the rendered form to a different workflow. Keeps every
   * other slice intact so user input is not lost when jumping between
   * Event / Task / Recurring inside the same panel session.
   */
  setWorkflow: (kind: WorkflowKind) => void;
  /** Toggle between the legacy monolithic editor and the specialized panel. */
  setLegacyEditor: (on: boolean) => void;

  identity: TileIdentitySlice;
  plan: Plan;
  time: TimeSlice;
  windows: Window[];
  source: SourceAuthoringSlice;
  recurring: RecurringSlice;
  recurrence: RecurrenceModel | RecurrenceTemplateRecurrence | null;
  advanced: AdvancedSlice;
  meta: MetaSlice;

  /**
   * Set a field by dotted path (e.g. `"identity.title"`,
   * `"time.span.start"`, `"recurring.life.state"`). Intermediate objects
   * must be initialised in advance — see `buildDefaultQuickCreateState`.
   * Array-index path segments are intentionally unsupported.
   */
  setField: (path: string, value: unknown) => void;
  addTask: (title?: string) => string;
  removeTask: (taskId: string) => void;
  reorderTasks: (fromIndex: number, toIndex: number) => void;
  setTaskField: (taskId: string, path: string, value: unknown) => void;
  /**
   * Flip the authoring-time `done` checkbox on a sub-task. Runtime
   * completion lives on `Execution.taskRuns[]`; this only edits the
   * sub-task editor's author-side state.
   */
  toggleTaskDone: (taskId: string) => void;
  /**
   * Insert a shallow copy of an existing sub-task immediately after the
   * source row. Resets `done` to `false` (a duplicate starts fresh) and
   * uses the source's `content.title` verbatim — the user renames it
   * inline. `order[]` rules are copied as-is, so any task-to-task
   * dependencies the source declared are inherited.
   *
   * Returns the new task id; returns an empty string if the source id
   * is not found so callers can no-op gracefully.
   */
  duplicateTask: (taskId: string) => string;
  /** Convenience: flips `plan.role` between EXECUTABLE / LABEL in sync with `meta.isLabelOnly`. */
  setLabelOnly: (isLabelOnly: boolean) => void;
  /**
   * Hydrate the form from an existing CalendarEvent so the panel can
   * be reused for editing.
   */
  loadFromEvent: (event: import("@/calendar/model/calendar").CalendarEvent) => void;
  /**
   * Full edit hydration for a placement-type event. Immediately opens the
   * panel with the data from the CalendarEvent, then fetches the v1 Tile to
   * fill in description / externalId / plan.role. If the GET fails, the basic
   * fields (title / color / span / tags / memo) remain editable.
   */
  loadFromPlacementEvent: (
    event: import("@/calendar/model/calendar").CalendarEvent,
  ) => Promise<void>;
  /**
   * Hydrate the form from an existing recurring Tile so the panel can be
   * reused for editing. Opens the panel FIRST in edit mode, then fetches
   * the full v1 Tile via getTile(id) and maps the v1 read view into the store.
   */
  loadFromRecurringTile: (tileId: string) => Promise<unknown | null>;
  /**
   * Hydrate the form from a starter Recurring template row.
   */
  loadFromTemplate: (template: RecurringTemplateShape) => void;
  /** Reset all field state to defaults; preserves `isOpen`. */
  reset: () => void;
  submitState: SubmitState;
  canSubmit: boolean;
  submitBlockedReason: string | null;
  fieldErrors: Map<string, string>;
  getFieldError: (path: string) => string | null;
  setSubmitState: (state: SubmitState) => void;
  resetSubmitState: () => void;
  setFieldErrors: (errors: Map<string, string>) => void;
  setCanSubmit: (v: boolean) => void;
  setSubmitBlockedReason: (reason: string | null) => void;
  /**
   * `JSON.stringify(normalizeForCompare(state))` captured at the moment a
   * loader (or `openEdit`) finished seeding the panel. `null` means "no
   * baseline captured yet" — `selectIsDirty` treats that as "clean" so the
   * submit button stays disabled until hydration completes. The comparison
   * is the deterministic key-order subset returned by `normalizeForCompare`,
   * so the same input always yields the same baseline string.
   */
  baseline: string | null;
  /**
   * Snapshot the current editable state into `baseline`. Called at the end
   * of every loader's data-seeding step so the next `setField` / `addTask`
   * / `removeTask` / `setTaskField` flips `selectIsDirty` to true.
   */
  captureBaseline: () => void;
}

/**
 * Pure selector for the dirty flag. In create mode this is always `true`
 * (the panel is "ready to submit when valid" the moment the user fills the
 * title); in edit mode it returns `false` until `captureBaseline` runs at
 * the end of the loader, and after that returns whether the editable
 * state has diverged from the captured baseline.
 */
export function selectIsDirty(state: QuickCreateState): boolean {
  if (state.mode === "create") return true;
  if (state.baseline === null) return false;
  return JSON.stringify(normalizeForCompare(state)) !== state.baseline;
}

/**
 * Build a stable plain-object view of the form-bearing slices so that
 * `JSON.stringify` produces a deterministic key-order output regardless of
 * how the original objects were constructed. Field order is explicit (no
 * spread) so the same input always yields the same string — that is what
 * makes the dirty gate reproducible.
 *
 * Includes EVERY slice the panel can edit, including wire-silently-dropped
 * ones (`frameRules`, `recurring.condition`, `source.relations`,
 * `source.flowSequences`, `plan.planning.flows`, `plan.metrics`,
 * `plan.decisions`, `advanced.changeSets`, `advanced.rules`) — see
 * `docs/plans/2026-08-15-quickcreate-edit-gate.md` for the rationale.
 * Excludes only transient UI flags (mode, isOpen, panel state, etc.).
 */
function normalizeForCompare(state: QuickCreateState): Record<string, unknown> {
  return {
    identity: {
      kind: state.identity.kind,
      title: state.identity.title,
      description: state.identity.description,
      externalId: state.identity.externalId,
      visual: {
        color: state.identity.visual.color,
        icon: state.identity.visual.icon,
      },
    },
    time: {
      timeModel: state.time.timeModel,
      schedulableWindow: {
        start: state.time.schedulableWindow.start,
        end: state.time.schedulableWindow.end,
      },
      span: { start: state.time.span.start, end: state.time.span.end },
      durationMinMax: {
        minMs: state.time.durationMinMax.minMs,
        maxMs: state.time.durationMinMax.maxMs,
      },
      whenMode: state.time.whenMode,
      timeOfDayMode: state.time.timeOfDayMode,
      timeOfDayStart: state.time.timeOfDayStart,
      timeOfDayEnd: state.time.timeOfDayEnd,
      referenceId: state.time.referenceId,
      referenceLabel: state.time.referenceLabel,
      splitPolicy: state.time.splitPolicy,
    },
    windows: [...state.windows].sort((a, b) => a.id.localeCompare(b.id)),
    plan: {
      role: state.plan.role,
      references: state.plan.references,
      completion: {
        root: state.plan.completion.root,
        // `timeRequirements[]` is excluded: its entries are server-side
        // structural rows whose `id` is `Math.random()`-generated and
        // whose user-authored content (`required.{minMs,maxMs}`) is
        // mirrored into `time.durationMinMax` above. Including them
        // would make the baseline non-reproducible across `reset()`.
        //
        // Task order is preserved (no sort by id) so that a user-driven
        // `reorderTasks(...)` registers as dirty. Sorting by id would
        // make the normalized form invariant under reorder, which
        // contradicts the user-facing semantics of dragging a task in
        // the UI.
        tasks: state.plan.completion.tasks,
      },
      planning: {
        placementRules: state.plan.planning.placementRules,
        nestingRules: state.plan.planning.nestingRules,
        flows: state.plan.planning.flows,
      },
      metrics: state.plan.metrics,
      decisions: state.plan.decisions,
    },
    source: {
      offsetMin: state.source.offsetMin,
      excludedDates: state.source.excludedDates,
      preferredDurationMinMax: {
        minMs: state.source.preferredDurationMinMax.minMs,
        maxMs: state.source.preferredDurationMinMax.maxMs,
      },
      splitPolicy: {
        kind: state.source.splitPolicy.kind,
        minSegmentMs: state.source.splitPolicy.minSegmentMs,
        maxSegmentMs: state.source.splitPolicy.maxSegmentMs,
        maxSegments: state.source.splitPolicy.maxSegments,
      },
      priority: state.source.priority,
      include: state.source.include,
      anchorMode: state.source.anchorMode,
      relations: state.source.relations,
      flowSequences: state.source.flowSequences,
    },
    recurring: {
      life: {
        active: {
          startDate: state.recurring.life.active.startDate,
          endDate: state.recurring.life.active.endDate,
        },
        state: state.recurring.life.state,
        // `changed` is a server-side audit Stamp (timestamp + actor) — the
        // panel does not author it, and its `at` timestamp can differ
        // across captures even when nothing else has changed. Excluded so
        // the baseline is reproducible.
      },
      frameRules: state.recurring.frameRules,
      rules: state.recurring.rules,
      repeatMode: state.recurring.repeatMode,
      weekdayMask: state.recurring.weekdayMask,
      endDate: state.recurring.endDate,
      intervalValue: state.recurring.intervalValue,
      intervalUnit: state.recurring.intervalUnit,
      condition: state.recurring.condition,
      conditionIgnored: state.recurring.conditionIgnored,
      monthlyKind: state.recurring.monthlyKind,
      monthlyDayOfMonth: state.recurring.monthlyDayOfMonth,
      monthlyWeekOfMonth: state.recurring.monthlyWeekOfMonth,
      monthlyWeekday: state.recurring.monthlyWeekday,
    },
    recurrence: state.recurrence,
    advanced: {
      changeSets: state.advanced.changeSets,
      rules: state.advanced.rules,
    },
    meta: {
      ownerSubjectId: state.meta.ownerSubjectId,
      memo: state.meta.memo,
      isLabelOnly: state.meta.isLabelOnly,
    },
  };
}

// ---------- defaults ----------

function defaultConditionRoot(): Plan["completion"]["root"] {
  return { kind: ConditionKind.ALL, children: [], term: null };
}

function defaultTimeRequirement(): TimeRequirement {
  // No authored completion time requirement yet. The wire's
  // requiredDuration() falls back to a 5-min cap for the empty-span
  // "place now" UX path when this is null. UI authors add requirements
  // explicitly via the CompletionSubPanel.
  return {
    id: `tr_${Math.random().toString(36).slice(2, 9)}`,
    observation: {
      scope: 1,
      source: 0,
      aggregate: 0,
      quantifier: 0,
    },
    required: {
      minMs: null,
      maxMs: null,
    },
    preferred: null,
  };
}

export function hasTaskOrderCycle(tasks: TaskDefinition[]): boolean {
  const edges = new Map<string, string[]>();
  for (const task of tasks) edges.set(task.id, []);
  for (const task of tasks) {
    for (const rule of task.order) {
      if (!edges.has(rule.targetTaskId)) continue;
      const next = rule.relation === TaskOrderRelation.BEFORE ? rule.targetTaskId : task.id;
      const from = rule.relation === TaskOrderRelation.BEFORE ? task.id : rule.targetTaskId;
      edges.get(from)?.push(next);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of edges.get(id) ?? []) if (visit(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...edges.keys()].some(visit);
}

export function tasksForSubmission(tasks: TaskDefinition[]): TaskDefinition[] {
  const titled = tasks.filter((task) => task.content.title.trim().length > 0);
  const ids = new Set(titled.map((task) => task.id));
  return titled.map((task) => ({
    ...task,
    order: task.order.filter((rule) => ids.has(rule.targetTaskId)),
  }));
}

function taskWithField(task: TaskDefinition, path: string, value: unknown): TaskDefinition {
  return setDeepPath(task as unknown as QuickCreateState, path, value) as unknown as TaskDefinition;
}

function defaultTask(title = ""): TaskDefinition {
  const id = uuidv7();
  return {
    id,
    content: { title, note: null },
    show: null,
    complete: {
      kind: ConditionKind.TERM,
      children: [],
      term: { kind: "task", value: { taskId: id, state: 2 } },
    },
    order: [],
    done: false,
  };
}

function defaultPlan(): Plan {
  return {
    role: PlanRole.EXECUTABLE,
    references: [],
    completion: {
      root: defaultConditionRoot(),
      timeRequirements: [defaultTimeRequirement()],
      tasks: [],
    },
    planning: {
      placementRules: [],
      nestingRules: [],
      flows: [],
    },
    metrics: [],
    decisions: [],
  };
}

function defaultIdentity(): TileIdentitySlice {
  return {
    kind: TileKind.PLACEMENT,
    title: "",
    description: null,
    // externalId is generated on the client after mount (uuidv7() uses
    // Date.now(), which would diverge between SSR and client and break
    // hydration). The UI also regenerates it on demand via the
    // "Regenerate" button.
    externalId: null,
    visual: { color: "#3b82f6", icon: "check-circle" },
  };
}

function defaultTime(): TimeSlice {
  // A new tile is floating until the user or scheduler creates a Placement.
  // No authored duration yet: the wire's requiredDuration() falls back to
  // a 5-min cap for the empty-span "place now" UX path so the new tile
  // appears in /v1/timeline even when surrounding SourceTile placements
  // (e.g. V1_015 休憩 seed) cover the adjacent slots.
  return {
    timeModel: "duration_only",
    schedulableWindow: { start: "", end: "" },
    span: { start: "", end: "" },
    durationMinMax: { minMs: null, maxMs: null },
    whenMode: "none",
    timeOfDayMode: "unspecified",
    timeOfDayStart: "",
    timeOfDayEnd: "",
    referenceId: null,
    referenceLabel: "",
    splitPolicy: "unsplit",
  };
}

function defaultRecurringLife(): RecurringSlice["life"] {
  return {
    active: { startDate: "", endDate: "" },
    state: RecurringState.ACTIVE,
    changed: {
      at: new Date().toISOString(),
      actor: { id: "self", kind: 0, ownerId: null },
    },
  };
}

function defaultRecurring(): RecurringSlice {
  return {
    life: defaultRecurringLife(),
    frameRules: [],
    rules: [],
    repeatMode: "once",
    weekdayMask: 0b0011111, // Mon–Fri
    endDate: "",
    intervalValue: 30,
    intervalUnit: "min",
    condition: null,
    conditionIgnored: false,
    monthlyKind: null,
    monthlyDayOfMonth: 1,
    monthlyWeekOfMonth: 1,
    monthlyWeekday: 0, // bit 0 (Monday) — matches the weekdayMask convention
  };
}

function defaultAdvanced(): AdvancedSlice {
  return { changeSets: [], rules: [] };
}

function defaultSourceAuthoring(): SourceAuthoringSlice {
  return {
    offsetMin: -new Date().getTimezoneOffset(),
    excludedDates: [],
    preferredDurationMinMax: { minMs: null, maxMs: null },
    splitPolicy: {
      kind: 0,
      minSegmentMs: null,
      maxSegmentMs: null,
      maxSegments: null,
    },
    priority: 0,
    include: "INCLUDED",
    anchorMode: "FIXED",
    relations: [],
    flowSequences: [],
  };
}

function defaultMeta(): MetaSlice {
  return {
    ownerSubjectId: null,
    memo: "",
    isLabelOnly: false,
  };
}

/**
 * Round `now` up to the next `minutes`-minute boundary (UTC ms) and
 * return an ISO string. Used by per-workflow initial values to seed
 * the Event / Recurring start time at a sensible "next quarter" slot.
 */
function nextSlotIso(minutes: number, now: Date = new Date()): string {
  const slotMs = minutes * 60_000;
  const nextSlot = Math.ceil(now.getTime() / slotMs) * slotMs;
  return new Date(nextSlot).toISOString();
}

/**
 * "Today at local midnight" as an ISO string. Used to seed the Task
 * form's due date so the user sees a non-empty DateInput on first open.
 */
function todayLocalMidnightIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Add `delta` minutes to an "HH:MM" string and return "HH:MM". Wraps
 * at 24:00 back to "00:00". Returns an empty string if input is empty
 * or unparseable so callers can leave the seed untouched when the
 * source time is missing.
 */
function addMinutesToHHMM(hhmm: string, delta: number): string {
  if (!hhmm) return "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return "";
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = ((h * 60 + m + delta) % (24 * 60) + 24 * 60) % (24 * 60);
  const nextH = Math.floor(total / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

/**
 * Inverse of `isoToTime` (defined per-workflow). Returns "HH:MM" extracted
 * from an ISO timestamp, or "" when the input is empty / unparseable.
 * Used by `loadFromEvent` / `loadFromPlacementEvent` to seed
 * `time.timeOfDayStart/End` when hydrating an edit-mode panel so the
 * legacy `timeOfDay` fields round-trip cleanly.
 */
function hhmmFromIso(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Apply workflow-specific initial values on `openCreate`. Mirrors the
 * intent documented in `openCreate` (slot-click → time-based entry, +
 * button / Cmd+N → form-based entry) so the panel shows meaningful
 * defaults the moment the form mounts:
 *
 *   task      — due date = today, duration = 30 min
 *   event     — start = next 15-min slot, end = +90 min, duration = 90 min
 *               (all-day toggle respected via `initialAllDay`)
 *   recurring — start = today at midnight, repeat = daily, duration = 30 min
 *   detailed  — start = today at midnight, duration = 30 min
 *               (aligns the legacy v1 editor with the new workflow forms
 *               so the user lands on a sensible starting point instead of
 *               an empty form)
 *
 * `timeOfDayMode` is driven by `initialAllDay` so the slot-click path
 * (`initialAllDay: false`) lands on a time-bearing event and the
 * sidebar + button / Cmd+N paths (also `initialAllDay: false`) keep
 * a time-bearing form. Callers that want an all-day form must pass
 * `initialAllDay: true`.
 *
 * Skipped entirely when no workflow is supplied — slot-click callers
 * already populate the time slice via `setField` before `openCreate`,
 * so we must not overwrite those values.
 */
const DEFAULT_EVENT_DURATION_MS = 90 * 60_000;
const DEFAULT_TASK_DURATION_MS = 30 * 60_000;
const DEFAULT_RECURRING_DURATION_MS = 30 * 60_000;

function defaultsForWorkflow(
  workflow: WorkflowKind,
  initialAllDay: boolean,
  now: Date = new Date(),
): Partial<Pick<QuickCreateState, "time" | "recurring" | "identity">> {
  if (workflow === "task") {
    return {
      time: {
        timeModel: "duration_only",
        schedulableWindow: { start: "", end: "" },
        span: { start: todayLocalMidnightIso(now), end: "" },
        durationMinMax: { minMs: DEFAULT_TASK_DURATION_MS, maxMs: DEFAULT_TASK_DURATION_MS },
        whenMode: "day",
        timeOfDayMode: "unspecified",
        timeOfDayStart: "",
        timeOfDayEnd: "",
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
    };
  }
  if (workflow === "event") {
    if (initialAllDay) {
      return {
        time: {
          timeModel: "fixed_window",
          schedulableWindow: { start: "00:00", end: "23:59" },
          span: { start: todayLocalMidnightIso(now), end: "" },
          durationMinMax: { minMs: DEFAULT_EVENT_DURATION_MS, maxMs: DEFAULT_EVENT_DURATION_MS },
          whenMode: "day",
          timeOfDayMode: "all-day",
          timeOfDayStart: "00:00",
          timeOfDayEnd: "23:59",
          referenceId: null,
          referenceLabel: "",
          splitPolicy: "unsplit",
        },
      };
    }
    const start = nextSlotIso(15, now);
    const end = new Date(new Date(start).getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
    return {
      time: {
        timeModel: "fixed_window",
        schedulableWindow: { start: "", end: "" },
        span: { start, end },
        durationMinMax: { minMs: DEFAULT_EVENT_DURATION_MS, maxMs: DEFAULT_EVENT_DURATION_MS },
        whenMode: "range",
        timeOfDayMode: "range",
        timeOfDayStart: "",
        timeOfDayEnd: "",
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
    };
  }
  if (workflow === "recurring") {
    return {
      time: {
        // Default the Recurring form to "window_with_duration" with a
        // 09:00–17:00 schedulable window — the most common authoring
        // shape ("do 30 min sometime between 9 and 5"). The user can
        // still flip to "duration_only" or "fixed_window" via the new
        // time-model radio.
        timeModel: "window_with_duration",
        schedulableWindow: { start: "09:00", end: "17:00" },
        span: { start: todayLocalMidnightIso(now), end: "" },
        durationMinMax: {
          minMs: DEFAULT_RECURRING_DURATION_MS,
          maxMs: DEFAULT_RECURRING_DURATION_MS,
        },
        whenMode: "day",
        // Calendar-bound modes (daily/weekly/monthly) edit
        // timeOfDayStart/End; interval mode edits span.start. The form
        // now uses timeOfDay fields whenever repeatMode is in the
        // calendar group, so seed those defaults here so the user
        // sees a meaningful 09:00 starting value on first open.
        timeOfDayMode: initialAllDay ? "all-day" : "range",
        timeOfDayStart: initialAllDay ? "00:00" : "09:00",
        // Seed a real time window (start + start + 60min) so the
        // Daily form opens with a meaningful end-time value, not a
        // mirror of the start. All-day overrides to 00:00–23:59.
        timeOfDayEnd: initialAllDay ? "23:59" : addMinutesToHHMM("09:00", 60),
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
      recurring: {
        life: defaultRecurringLife(),
        frameRules: [],
        rules: [],
        // Safer default: open the Recurring workflow in "once" mode so the
        // user has to opt-in to recurring. Previously seeded "daily" which
        // forced recurring whenever the user switched workflow views. The
        // user can still pick daily/weekly/monthly/interval from the
        // selector above — see AGENTS feedback
        // "ビュー切り替えで誤った操作で繰り返しを有効にしてしまった".
        repeatMode: "once",
        weekdayMask: 0b0011111, // Mon–Fri
        endDate: "",
        intervalValue: 30,
        intervalUnit: "min",
        condition: null,
        conditionIgnored: false,
        // Default Monthly authoring to By day with today's day-of-month
        // so the user lands on a meaningful value instead of an empty
        // field. The user can switch to By weekday from the segmented
        // control above; the opposing field is reset on switch.
        monthlyKind: "by_day",
        monthlyDayOfMonth: now.getDate(),
        monthlyWeekOfMonth: 1,
        monthlyWeekday: 0,
      },
      identity: {
        ...defaultIdentity(),
        kind: TileKind.RECURRING,
        visual: { color: "#5e6ad2", icon: "Repeat" },
      },
    };
  }
  if (workflow === "detailed") {
    // Align the legacy v1 editor with the new workflow forms: seed today's
    // local-midnight date and a 30-min duration so the user doesn't have
    // to fill the time + duration sub-panels just to land on a sensible
    // starting point. The legacy editor's sub-panels still own their own
    // fields, so this only affects the top-level `time` slice.
    return {
      time: {
        timeModel: "duration_only",
        schedulableWindow: { start: "", end: "" },
        span: { start: todayLocalMidnightIso(now), end: "" },
        durationMinMax: { minMs: DEFAULT_TASK_DURATION_MS, maxMs: DEFAULT_TASK_DURATION_MS },
        whenMode: "day",
        timeOfDayMode: "unspecified",
        timeOfDayStart: "",
        timeOfDayEnd: "",
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
    };
  }
  return {};
}

export function buildDefaultQuickCreateState(): Pick<
  QuickCreateState,
  | "isOpen"
  | "mode"
  | "editingId"
  | "editingTileId"
  | "loadError"
  | "submitBlocked"
  | "initialAllDay"
  | "workflowKind"
  | "useLegacyEditor"
  | "activePanel"
  | "identity"
  | "plan"
  | "time"
  | "windows"
  | "source"
  | "recurring"
  | "recurrence"
  | "advanced"
  | "meta"
  | "submitState"
  | "canSubmit"
  | "submitBlockedReason"
  | "fieldErrors"
  | "baseline"
> {
  return {
    isOpen: false,
    mode: "create",
    editingId: null,
    editingTileId: null,
    loadError: null,
    submitBlocked: false,
    initialAllDay: false,
    workflowKind: null,
    useLegacyEditor: false,
    activePanel: "base" as SubPanelKey,
    identity: defaultIdentity(),
    plan: defaultPlan(),
    time: defaultTime(),
    windows: [],
    source: defaultSourceAuthoring(),
    recurring: defaultRecurring(),
    recurrence: null,
    advanced: defaultAdvanced(),
    meta: defaultMeta(),
    submitState: { kind: "idle" },
    canSubmit: false,
    submitBlockedReason: null,
    fieldErrors: new Map(),
    baseline: null,
  };
}

// ---------- path setter ----------

function setDeepPath(state: QuickCreateState, path: string, value: unknown): QuickCreateState {
  const segments = path.split(".");
  if (segments.length === 0) return state;
  const [head, ...rest] = segments;
  if (head === undefined) return state;
  if (rest.length === 0) {
    return { ...state, [head]: value } as QuickCreateState;
  }
  const next = (state as unknown as Record<string, unknown>)[head];
  if (next === null || next === undefined || typeof next !== "object") {
    return state;
  }
  const updated = setDeepPath(next as QuickCreateState, rest.join("."), value);
  return { ...state, [head]: updated } as QuickCreateState;
}

// ---------- store ----------

export const useQuickCreateStore = create<QuickCreateState>()((set, get) => ({
  ...buildDefaultQuickCreateState(),
  open: () => set({ isOpen: true }),
  openCreate: (options?: { initialAllDay?: boolean; workflow?: WorkflowKind }) => {
    const workflow = options?.workflow ?? null;
    const initialAllDay = options?.initialAllDay ?? false;
    if (!workflow) {
      return set((state) => ({
        isOpen: true,
        mode: "create" as const,
        editingId: null,
        workflowKind: null,
        initialAllDay: options?.initialAllDay ?? state.initialAllDay,
      }));
    }
    const defaults = defaultsForWorkflow(workflow, initialAllDay);
    return set((state) => {
      const base = buildDefaultQuickCreateState();
      return {
        ...base,
        isOpen: true,
        mode: "create" as const,
        editingId: null,
        editingTileId: null,
        loadError: null,
        submitBlocked: false,
        initialAllDay,
        workflowKind: workflow,
        activePanel: state.activePanel,
        submitState: { kind: "idle" },
        fieldErrors: new Map(),
        identity: defaults.identity ?? base.identity,
        time: defaults.time ?? base.time,
        recurring: defaults.recurring ?? base.recurring,
      };
    });
  },
  openEdit: (
    eventId: string,
    tileId?: string | null,
    workflow?: WorkflowKind,
  ) =>
    set({
      isOpen: true,
      mode: "edit",
      editingId: eventId,
      editingTileId: tileId ?? null,
      workflowKind: workflow ?? null,
    }),
  close: () =>
    set({
      isOpen: false,
      mode: "create",
      editingId: null,
      editingTileId: null,
      loadError: null,
      workflowKind: null,
      activePanel: "base",
      submitState: { kind: "idle" },
      fieldErrors: new Map(),
      baseline: null,
    }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setWorkflow: (kind) =>
    set(() => ({
      // View-only transition: switching workflows preserves the
      // underlying store data. Initial seeding happens once in
      // `openCreate` (not here). Edit mode is unchanged because the
      // loaded tile data is the source of truth there.
      workflowKind: kind,
    })),
  setLegacyEditor: (on) => set({ useLegacyEditor: on }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  getFieldError: (path) => get().fieldErrors.get(path) ?? null,
  setSubmitState: (state) => set({ submitState: state }),
  resetSubmitState: () => set({ submitState: { kind: "idle" } }),
  setFieldErrors: (errors) => set({ fieldErrors: errors }),
  setCanSubmit: (v) => set({ canSubmit: v }),
  setSubmitBlockedReason: (reason) => set({ submitBlockedReason: reason }),
  captureBaseline: () =>
    set({ baseline: JSON.stringify(normalizeForCompare(get())) }),
  setField: (path, value) =>
    set((state) => {
      const next = setDeepPath(state, path, value);
      // E1a: sync conditionIgnored when recurring.condition changes
      if (path === "recurring.condition") {
        const ignored = value !== null;
        if (next.recurring.conditionIgnored !== ignored) {
          return { ...next, recurring: { ...next.recurring, conditionIgnored: ignored } };
        }
      }
      const updatesRequired = path.startsWith("time.durationMinMax.");
      const updatesPreferred = path.startsWith("source.preferredDurationMinMax.");
      if (!updatesRequired && !updatesPreferred) return next;
      const [first, ...remaining] = next.plan.completion.timeRequirements;
      if (!first) return next;
      return {
        ...next,
        plan: {
          ...next.plan,
          completion: {
            ...next.plan.completion,
            timeRequirements: [
              {
                ...first,
                required: updatesRequired
                  ? {
                      minMs: next.time.durationMinMax.minMs,
                      maxMs: next.time.durationMinMax.maxMs,
                    }
                  : first.required,
                preferred: updatesPreferred
                  ? {
                      minMs: next.source.preferredDurationMinMax.minMs,
                      maxMs: next.source.preferredDurationMinMax.maxMs,
                    }
                  : first.preferred,
              },
              ...remaining,
            ],
          },
        },
      };
    }),
  addTask: (title = "") => {
    const task = defaultTask(title);
    set((state) => ({
      plan: {
        ...state.plan,
        completion: {
          ...state.plan.completion,
          tasks: [...state.plan.completion.tasks, task],
        },
      },
    }));
    return task.id;
  },
  removeTask: (taskId) =>
    set((state) => ({
      plan: {
        ...state.plan,
        completion: {
          ...state.plan.completion,
          tasks: state.plan.completion.tasks.reduce(
            (acc, task) => {
              if (task.id === taskId) return acc;
              acc.push({
                ...task,
                order: task.order.filter((rule) => rule.targetTaskId !== taskId),
              });
              return acc;
            },
            [] as typeof state.plan.completion.tasks,
          ),
        },
      },
    })),
  reorderTasks: (fromIndex, toIndex) =>
    set((state) => {
      const tasks = [...state.plan.completion.tasks];
      if (fromIndex < 0 || fromIndex >= tasks.length) return state;
      if (toIndex < 0 || toIndex >= tasks.length) return state;
      const [moved] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, moved);
      return {
        plan: {
          ...state.plan,
          completion: {
            ...state.plan.completion,
            tasks,
          },
        },
      };
    }),
  setTaskField: (taskId, path, value) =>
    set((state) => ({
      plan: {
        ...state.plan,
        completion: {
          ...state.plan.completion,
          tasks: state.plan.completion.tasks.map((task) =>
            task.id === taskId ? taskWithField(task, path, value) : task,
          ),
        },
      },
    })),
  toggleTaskDone: (taskId) =>
    set((state) => {
      let found = false;
      const tasks = state.plan.completion.tasks.map((task) => {
        if (task.id !== taskId) return task;
        found = true;
        return { ...task, done: !task.done };
      });
      if (!found) return state;
      return {
        plan: {
          ...state.plan,
          completion: {
            ...state.plan.completion,
            tasks,
          },
        },
      };
    }),
  duplicateTask: (taskId) => {
    let newId = "";
    set((state) => {
      const source = state.plan.completion.tasks.find((task) => task.id === taskId);
      if (!source) return state;
      const fresh = defaultTask(source.content.title);
      newId = fresh.id;
      const duplicate: TaskDefinition = {
        ...fresh,
        content: { title: source.content.title, note: source.content.note },
        order: source.order.map((rule) => ({ ...rule })),
      };
      const tasks = [...state.plan.completion.tasks];
      const insertAt = tasks.findIndex((task) => task.id === taskId) + 1;
      tasks.splice(insertAt, 0, duplicate);
      return {
        plan: {
          ...state.plan,
          completion: {
            ...state.plan.completion,
            tasks,
          },
        },
      };
    });
    return newId;
  },
  setLabelOnly: (isLabelOnly) =>
    set(() => ({
      meta: { ...useQuickCreateStore.getState().meta, isLabelOnly },
      plan: {
        ...useQuickCreateStore.getState().plan,
        role: isLabelOnly ? PlanRole.LABEL : PlanRole.EXECUTABLE,
      },
    })),
  loadFromEvent: (event) => {
    // Map `allDay` directly to `time.timeOfDayMode` so the Event form's
    // `allDay` Switch reflects the loaded state on open (instead of
    // silently defaulting to a time-bearing event when the user opens an
    // all-day placement for edit).
    const allDay = event.allDay === true;
    const startHHMM = allDay ? "00:00" : hhmmFromIso(event.start);
    const endHHMM = allDay ? "23:59" : hhmmFromIso(event.end);
    set(() => ({
      isOpen: true,
      mode: "edit" as const,
      editingId: event.id,
      editingTileId: event.tileId ?? null,
      workflowKind: "event" as WorkflowKind,
      identity: {
        kind: TileKind.PLACEMENT,
        title: event.title,
        description: event.description ?? null,
        externalId: null,
        visual: {
          color: event.color,
          icon: event.icon ?? "check-circle",
        },
      },
      time: {
        timeModel: "fixed_window",
        schedulableWindow: { start: "", end: "" },
        span: { start: event.start, end: event.end },
        durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
        whenMode: event.start || event.end ? (event.end ? "range" : "day") : "none",
        timeOfDayMode: allDay ? "all-day" : event.end ? "range" : "unspecified",
        timeOfDayStart: startHHMM,
        timeOfDayEnd: endHHMM,
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
      meta: {
        ...useQuickCreateStore.getState().meta,
        memo: event.memo ?? "",
      },
    }));
    // Capture baseline after seeding so the next `setField` flips
    // `selectIsDirty` to true.
    get().captureBaseline();
  },
  loadFromPlacementEvent: async (event) => {
    // 1. Immediately open the panel in edit mode with event-level data so the
    //    user sees a responsive UI while the full tile fetch is in flight.
    const colorHex =
      typeof event.color === "string" && event.color.startsWith("#")
        ? event.color
        : (() => {
            const colorMap: Record<string, string> = {
              blue: "#3b82f6",
              green: "#22c55e",
              purple: "#a855f7",
              orange: "#f97316",
              pink: "#ec4899",
              cyan: "#06b6d4",
              yellow: "#eab308",
              red: "#ef4444",
              teal: "#14b8a6",
              indigo: "#6366f1",
              lime: "#84cc16",
              gray: "#6b7280",
            };
            return colorMap[event.color as string] ?? "#3b82f6";
          })();

    const colon = event.id.indexOf(":");
    const placementId = colon > 0 ? event.id.slice(0, colon) : event.id;

    // Map `allDay` directly to `time.timeOfDayMode` so the Event form's
    // `allDay` Switch reflects the loaded state on open. Without this,
    // opening an all-day placement silently lands on a time-bearing form
    // (see loadFromEvent for the same rationale).
    const allDay = event.allDay === true;
    const startHHMM = allDay ? "00:00" : hhmmFromIso(event.start);
    const endHHMM = allDay ? "23:59" : hhmmFromIso(event.end);

    set({
      isOpen: true,
      mode: "edit" as const,
      editingId: placementId,
      editingTileId: event.tileId ?? null,
      workflowKind: "event" as WorkflowKind,
      loadError: null,
      submitBlocked: false,
      identity: {
        kind: TileKind.PLACEMENT,
        title: event.title,
        description: event.description ?? null,
        externalId: null,
        visual: {
          color: colorHex,
          icon: event.icon ?? "check-circle",
        },
      },
      time: {
        timeModel: "fixed_window",
        schedulableWindow: { start: "", end: "" },
        span: { start: event.start, end: event.end },
        durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
        whenMode: event.start || event.end ? (event.end ? "range" : "day") : "none",
        timeOfDayMode: allDay ? "all-day" : event.end ? "range" : "unspecified",
        timeOfDayStart: startHHMM,
        timeOfDayEnd: endHHMM,
        referenceId: null,
        referenceLabel: "",
        splitPolicy: "unsplit",
      },
      meta: {
        ...defaultMeta(),
        memo: event.memo ?? "",
      },
    });
    // Capture baseline from the synchronous phase so even an unenriched
    // open (no tile id, or tile fetch that fails) still gets a usable
    // isDirty gate.
    get().captureBaseline();

    // 2. Async-enrich with full tile data (description / externalId / plan.role).
    //    Failures are surfaced as a banner but do NOT block submit — the event-
    //    level data is sufficient for an identity + span update.
    const tileId = event.tileId;
    if (!tileId) return;

    try {
      const { getCoreClient } = await import("@/shared/api/endpoints");
      const res = await getCoreClient().call<unknown>("getTile", {
        pathParams: { id: tileId },
      });
      if (!res.ok || !res.data) return;
      const tile = res.data as {
        id: string;
        kind: 0 | 1 | 2;
        title: string;
        description: string | null;
        color: string | null;
        icon: string | null;
        external_id: string | null;
        plan_role: number | null;
      };
      set((state) => ({
        identity: {
          ...state.identity,
          description: tile.description ?? state.identity.description,
          externalId: tile.external_id ?? null,
          visual: {
            color: tile.color ?? state.identity.visual.color,
            icon: tile.icon ?? state.identity.visual.icon,
          },
        },
      }));
      // Re-capture baseline so the async enrichment (which mutates
      // identity fields) doesn't itself flip isDirty to true.
      get().captureBaseline();
    } catch {
      // Non-fatal — the basic event data is still usable. Keep the
      // baseline captured from the synchronous phase; loadError is the
      // banner, submitBlocked stays false so the user can edit-and-submit.
      set({
        loadError: `Could not load full tile data for ${tileId}. Basic fields are still editable.`,
      });
    }
  },
  loadFromRecurringTile: async (tileId: string) => {
    set({
      isOpen: true,
      mode: "edit" as const,
      editingId: tileId,
      editingTileId: tileId,
      workflowKind: "recurring" as WorkflowKind,
      loadError: null,
      submitBlocked: false,
      identity: {
        ...defaultIdentity(),
        kind: TileKind.RECURRING,
        visual: { color: "#5e6ad2", icon: "Repeat" },
      },
      time: defaultTime(),
      meta: defaultMeta(),
      recurrence: null,
    });

    try {
      const { getCoreClient } = await import("@/shared/api/endpoints");
      const res = await getCoreClient().call<unknown>("getTile", {
        pathParams: { id: tileId },
      });
      if (!res.ok || !res.data) {
        const detail = !res.ok
          ? `status=${res.error.kind} ${res.error.message ?? ""}`.trim()
          : "empty response";
        set({
          submitBlocked: true,
          loadError: `Failed to load recurring tile ${tileId} (${detail}). Submit is blocked until the tile is re-fetchable; reload or close the panel.`,
        });
        return null;
      }
      const tile = res.data as {
        id: string;
        kind: 0 | 1 | 2;
        title: string;
        description: string | null;
        color: string | null;
        icon: string | null;
        external_id: string | null;
        plan_id: string | null;
      };
      const incomingKind =
        tile.kind === TileKind.PLACEMENT || tile.kind === TileKind.EXECUTION
          ? tile.kind
          : TileKind.RECURRING;
      set({
        submitBlocked: false,
        identity: {
          kind: incomingKind,
          title: tile.title ?? "",
          description: tile.description ?? null,
          externalId: tile.external_id ?? null,
          visual: {
            color: tile.color ?? "#5e6ad2",
            icon: tile.icon ?? (incomingKind === TileKind.RECURRING ? "Repeat" : "check-circle"),
          },
        },
        meta: {
          ...useQuickCreateStore.getState().meta,
          memo: "",
        },
        recurrence: null,
      });
      // Capture baseline only on the success branch. On failure the
      // baseline stays null so `selectIsDirty` returns false (button
      // stays disabled) and the loadError banner + submitBlocked gate
      // are the only signals the user sees.
      get().captureBaseline();
      return tile;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        submitBlocked: true,
        loadError: `Failed to load recurring tile ${tileId}: ${msg}. Submit is blocked until the tile is re-fetchable; reload or close the panel.`,
      });
      return null;
    }
  },
  loadFromTemplate: (template) => {
    set({
      isOpen: true,
      mode: "create" as const,
      editingId: null,
      editingTileId: null,
      workflowKind: "recurring" as WorkflowKind,
      loadError: null,
      submitBlocked: false,
      identity: {
        ...defaultIdentity(),
        kind: TileKind.RECURRING,
        title: template.title,
        description: template.note?.trim() ? template.note : null,
        visual: { color: "#5e6ad2", icon: "Repeat" },
      },
      time: defaultTime(),
      meta: defaultMeta(),
      recurrence: template.recurrence,
    });
    // Mode is "create" so the baseline snapshot is informational only —
    // `selectIsDirty` always returns true in create mode and the gate
    // is driven by `canSubmit`. Capturing keeps the round-trip
    // deterministic if a future flow flips to edit mode mid-session.
    get().captureBaseline();
  },
  reset: () =>
    set((state) => ({
      ...buildDefaultQuickCreateState(),
      isOpen: state.isOpen,
    })),
}));
