/**
 * QuickCreateStore — single source of truth for the QuickTileCreate form.
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
 * submit flow (`@/lib/api/v1/submit`) reads this store directly to build
 * the v1 envelope sequence — there is no v7-shaped intermediate form state.
 *
 * Slice naming follows the v1 spec section that owns the data, not the
 * UI section that displays it. `frameRules` is intentionally distinct
 * from `frames` on the v1 `Recurring` aggregate: the form edits input
 * `FrameRule[]` (what the worker materializes from), while the
 * aggregate stores materialized `Frame[]` (worker output).
 */

import { create } from "zustand";
import type { RecurrenceModel } from "@/lib/domain/tile";
import type { Stamp } from "@/lib/domain/v1/actor";
import type { ChangeRule } from "@/lib/domain/v1/change-set";
import type { TaskDefinition, TimeRequirement } from "@/lib/domain/v1/completion";
import {
  ConditionKind,
  PlanRole,
  RecurringState,
  type RecurringStateValue,
  TaskOrderRelation,
  TileKind,
  type TileKindValue,
} from "@/lib/domain/v1/constants";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { FrameRule, Plan, RecurringRule } from "@/lib/domain/v1/tile";
import type { DateRange, DurationRange, Span, Window } from "@/lib/domain/v1/window";

/**
 * Structural shape of a starter template row's `recurrence` field as
 * emitted by the proxy's `toRecurringTemplateList` (open-struct, no
 * `kind` discriminator on `generator`). The store only round-trips
 * this through to the form as a seed — Submit reconstructs the v1
 * FrameRule body from form fields, so we do not constrain this to the
 * strict `RecurrenceModel` discriminated union.
 */
export interface RecurrenceTemplateRecurrence {
  generator: {
    focus_block_based?: { phases: Array<{ focus_min: number; break_min: number }> };
    step_min?: number;
  };
  window: {
    weekday_mask: number;
    start_offset_min: number;
    end_offset_min: number;
  };
  selector: {
    expression: unknown | null;
  };
}

export type RepeatChoice = "once" | "daily" | "weekly" | "interval" | "condition";

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

export interface TimeSlice {
  span: Span;
  durationMinMax: DurationRange;
  whenMode: WhenMode;
  timeOfDayMode: TimeOfDayMode;
  timeOfDayStart: string;
  timeOfDayEnd: string;
  referenceId: string | null;
  referenceLabel: string;
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
}

export interface AdvancedSlice {
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
    kind: 0 | 1;
    minSegmentMs: number | null;
    maxSegmentMs: number | null;
    maxSegments: number | null;
  };
  priority: number;
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
    when: import("@/lib/domain/v1/condition").ConditionNode | null;
    candidateWhen: import("@/lib/domain/v1/condition").ConditionNode | null;
    minimumGapMs: number;
    rank: number;
    steps: Array<{ id: string; waitBeforeMs: number; emitDurationMs: number }>;
  }>;
}

export interface MetaSlice {
  ownerSubjectId: string | null;
  project: string | null;
  tags: string[];
  memo: string;
  /** Backwards-compat: `true` mirrors `plan.role = LABEL`. Set via setLabelOnly. */
  isLabelOnly: boolean;
}

// ---------- store ----------

export type QuickCreateMode = "create" | "edit";

export type SubmitState =
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
export interface RecurringTemplateShape {
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
   * When true, QuickTileCreate's Submit is gated so the user cannot
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
  open: () => void;
  openCreate: (options?: { initialAllDay?: boolean }) => void;
  openEdit: (eventId: string, tileId?: string | null) => void;
  close: () => void;
  toggle: () => void;

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
  setTaskField: (taskId: string, path: string, value: unknown) => void;
  /** Convenience: flips `plan.role` between EXECUTABLE / LABEL in sync with `meta.isLabelOnly`. */
  setLabelOnly: (isLabelOnly: boolean) => void;
  /**
   * Hydrate the form from an existing CalendarEvent so the panel can
   * be reused for editing.
   */
  loadFromEvent: (event: import("@/lib/domain/calendar").CalendarEvent) => void;
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
  resetSubmitState: () => void;
}

// ---------- defaults ----------

function defaultConditionRoot(): Plan["completion"]["root"] {
  return { kind: ConditionKind.ALL, children: [], term: null };
}

function defaultTimeRequirement(): TimeRequirement {
  return {
    id: `tr_${Math.random().toString(36).slice(2, 9)}`,
    observation: {
      scope: 1,
      source: 0,
      aggregate: 0,
      quantifier: 0,
    },
    required: {
      minMs: 30 * 60_000,
      maxMs: 90 * 60_000,
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
  };
}

function defaultPlan(): Plan {
  return {
    role: PlanRole.EXECUTABLE,
    references: [],
    completion: {
      root: defaultConditionRoot(),
      timeRequirements: [defaultTimeRequirement()],
      tasks: [defaultTask("Mark done")],
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
  // Keep its required duration, but never fabricate a fixed span.
  return {
    span: { start: "", end: "" },
    durationMinMax: { minMs: 30 * 60_000, maxMs: 90 * 60_000 },
    whenMode: "none",
    timeOfDayMode: "unspecified",
    timeOfDayStart: "",
    timeOfDayEnd: "",
    referenceId: null,
    referenceLabel: "",
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
    relations: [],
    flowSequences: [],
  };
}

function defaultMeta(): MetaSlice {
  return {
    ownerSubjectId: null,
    project: null,
    tags: [],
    memo: "",
    isLabelOnly: false,
  };
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
> {
  return {
    isOpen: false,
    mode: "create",
    editingId: null,
    editingTileId: null,
    loadError: null,
    submitBlocked: false,
    initialAllDay: false,
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
  openCreate: (options?: { initialAllDay?: boolean }) =>
    set((state) => ({
      isOpen: true,
      mode: "create" as const,
      editingId: null,
      initialAllDay: options?.initialAllDay ?? state.initialAllDay,
    })),
  openEdit: (eventId: string, tileId?: string | null) =>
    set({ isOpen: true, mode: "edit", editingId: eventId, editingTileId: tileId ?? null }),
  close: () =>
    set({
      isOpen: false,
      mode: "create",
      editingId: null,
      editingTileId: null,
      loadError: null,
      submitState: { kind: "idle" },
    }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  getFieldError: (path) => get().fieldErrors.get(path) ?? null,
  resetSubmitState: () => set({ submitState: { kind: "idle" } }),
  setField: (path, value) =>
    set((state) => {
      const next = setDeepPath(state, path, value);
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
          tasks: state.plan.completion.tasks
            .filter((task) => task.id !== taskId)
            .map((task) => ({
              ...task,
              order: task.order.filter((rule) => rule.targetTaskId !== taskId),
            })),
        },
      },
    })),
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
  setLabelOnly: (isLabelOnly) =>
    set(() => ({
      meta: { ...useQuickCreateStore.getState().meta, isLabelOnly },
      plan: {
        ...useQuickCreateStore.getState().plan,
        role: isLabelOnly ? PlanRole.LABEL : PlanRole.EXECUTABLE,
      },
    })),
  loadFromEvent: (event) =>
    set(() => ({
      editingId: event.id,
      editingTileId: event.tileId ?? null,
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
        span: { start: event.start, end: event.end },
        durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
        whenMode: event.start || event.end ? (event.end ? "range" : "day") : "none",
        timeOfDayMode: "unspecified",
        timeOfDayStart: "",
        timeOfDayEnd: "",
        referenceId: null,
        referenceLabel: "",
      },
      meta: {
        ...useQuickCreateStore.getState().meta,
        tags: Array.isArray(event.tags) ? event.tags : [],
        memo: event.memo ?? "",
      },
    })),
  loadFromRecurringTile: async (tileId: string) => {
    set({
      isOpen: true,
      mode: "edit" as const,
      editingId: tileId,
      editingTileId: tileId,
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
      const { getCoreClient } = await import("@/lib/api/endpoints");
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
          tags: [],
          memo: "",
        },
        recurrence: null,
      });
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
  },
  reset: () =>
    set((state) => ({
      ...buildDefaultQuickCreateState(),
      isOpen: state.isOpen,
    })),
}));
