/**
 * QuickCreateStore — single source of truth for the QuickTileCreate form.
 *
 * The form is a multi-layer overlay: BasePanel → 6 SubPanels → Editors.
 * All panels read/write this same store; state flows through `setField`.
 *
 * Fields mirror the v1 domain types in `@/lib/domain/v1`. We only keep the
 * shape needed for *creating* a tile here; editing reuses the same store.
 */

import { create } from "zustand";
import {
  PlanRole,
  RecurringState,
  TileKind,
  type TileKindValue,
} from "@/lib/domain/v1/constants";
import type { FrameRule } from "@/lib/domain/v1/tile";
import type { Plan } from "@/lib/domain/v1/tile";
import type { TimeRequirement, TaskDefinition } from "@/lib/domain/v1/completion";
import type { Window, Span, DurationRange } from "@/lib/domain/v1/window";
import type { Recurring } from "@/lib/domain/v1/tile";
import type { RecurrenceModel } from "@/lib/domain/tile";

// ---------- slice types ----------

export interface TileIdentitySlice {
  kind: TileKindValue;
  title: string;
  description: string | null;
  externalId: string | null;
  visual: { color: string; icon: string };
}

export interface TimeSlice {
  span: Span;
  durationMinMax: DurationRange;
}

export interface RecurringSlice {
  life: Recurring["life"];
  frameRules: FrameRule[];
  rules: Recurring["rules"];
}

export interface AdvancedSlice {
  changeSets: unknown[];
  rules: unknown[];
}

export interface MetaSlice {
  project: string | null;
  tags: string[];
  memo: string;
}

// ---------- store ----------

export type QuickCreateMode = "create" | "edit";

export interface QuickCreateState {
  // Backwards-compat open/close surface retained so existing consumers
  // (QuickTileCreate, layout clients, ActivityBar, etc.) keep compiling.
  // The new model is live editing: panel renders unconditionally and the
  // store is the single source of truth for all field state.
  isOpen: boolean;
  mode: QuickCreateMode;
  editingId: string | null;
  /**
   * When opening create, the panel uses this as the initial allDay
   * toggle. The slot-click flow sets this to false so the user sees
   * the slot time; the sidebar + button leaves it at true.
   */
  initialAllDay: boolean;
  open: () => void;
  openCreate: (options?: { initialAllDay?: boolean }) => void;
  openEdit: (eventId: string) => void;
  close: () => void;
  toggle: () => void;

  identity: TileIdentitySlice;
  plan: Plan;
  time: TimeSlice;
  windows: Window[];
  recurring: RecurringSlice;
  recurrence: RecurrenceModel | null;
  advanced: AdvancedSlice;
  meta: MetaSlice;

  setField: (path: string, value: unknown) => void;
  /**
   * Hydrate the form from an existing CalendarEvent so the panel can
   * be reused for editing. Title, description, span, duration, project,
   * tags, and memo are mapped. Fields that are immutable post-create
   * (kind, plan.role, windows, frame rules) are intentionally not
   * mutated — the editor surfaces in `QuickTileCreate` hide those
   * rows in edit mode.
   */
  loadFromEvent: (
    event: import("@/lib/domain/calendar").CalendarEvent,
  ) => void;
  reset: () => void;
}

// ---------- defaults ----------

function defaultConditionRoot(): Plan["completion"]["root"] {
  // Root is an ALL aggregator. We pre-seed it with a single TaskTerm pointing at
  // the default task seeded by defaultPlan(), so the completion condition is
  // non-vacuous on first paint. Editors can replace or extend this freely.
  const defaultTaskId = "task_default";
  return {
    kind: 0, // ALL
    children: [
      {
        kind: 3, // TERM
        children: [],
        term: { kind: "task", value: { taskId: defaultTaskId, state: 2 } }, // COMPLETED
      },
    ],
    term: null,
  };
}

function defaultTimeRequirement(): TimeRequirement {
  // Sensible work-window default: placement's total active duration
  // must fall within 30–90 minutes. Editors expose scope / aggregate
  // for finer control; the id is regenerated on every fresh form
  // mount so persisted forms never collide.
  return {
    id: "tr_" + Math.random().toString(36).slice(2, 9),
    observation: {
      scope: 1, // PLACEMENT
      source: 0, // ACTIVE_SEGMENT
      aggregate: 0, // TOTAL_DURATION
      quantifier: 0, // ALL
    },
    required: {
      minMs: 30 * 60_000,
      maxMs: 90 * 60_000,
    },
    preferred: null,
  };
}

function defaultTask(): TaskDefinition {
  // Stable id so the TaskTerm seeded in defaultConditionRoot() references the
  // first task by name. Subsequent added tasks still use random ids.
  const id = "task_default";
  return {
    id,
    content: { title: "作業完了", note: null },
    show: null,
    complete: {
      kind: 3, // TERM
      children: [],
      term: { kind: "task", value: { taskId: id, state: 2 } }, // COMPLETED
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
      tasks: [defaultTask()],
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
    // "再生成" button.
    externalId: null,
    visual: { color: "#3b82f6", icon: "check-circle" },
  };
}

function defaultTime(): TimeSlice {
  // Default to the next half-hour, 30 minutes long. Round up to the
  // nearest 30-minute boundary so the start always aligns with what
  // a Google Calendar picker would suggest.
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = new Date(now);
  if (minutes < 30) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setHours(now.getHours() + 1, 0, 0, 0);
  }
  const start = rounded.toISOString();
  const end = new Date(rounded.getTime() + 30 * 60_000).toISOString();
  return {
    span: { start, end },
    durationMinMax: { minMs: 30 * 60_000, maxMs: 90 * 60_000 },
  };
}

function defaultRecurring(): RecurringSlice {
  return {
    life: {
      active: { startDate: "", endDate: "" },
      state: RecurringState.ACTIVE,
      // TODO: validate before submit — `actor.kind` should be an ActorKindValue
      // and `at` should be a real ISO timestamp.
      changed: {
        at: new Date().toISOString(),
        actor: { id: "self", kind: 0, ownerId: null },
      },
    },
    frameRules: [],
    rules: [],
  };
}

function defaultRecurrenceModel(): RecurrenceModel {
  return {
    generator: {
      kind: "time_based",
      step_min: 1440,
      anchor_epoch_min: null,
    },
    window: {
      weekday_mask: 0b0011111, // Mon–Fri
      start_offset_min: 9 * 60,
      end_offset_min: 18 * 60,
      exclusions: [],
    },
    selector: {
      expression: null,
    },
  };
}

function defaultAdvanced(): AdvancedSlice {
  return { changeSets: [], rules: [] };
}

function defaultMeta(): MetaSlice {
  return {
    project: null,
    tags: [],
    memo: "",
  };
}

export function buildDefaultQuickCreateState(): Pick<
  QuickCreateState,
  | "isOpen"
  | "mode"
  | "editingId"
  | "initialAllDay"
  | "identity"
  | "plan"
  | "time"
  | "windows"
  | "recurring"
  | "recurrence"
  | "advanced"
  | "meta"
> {
  return {
    isOpen: false,
    mode: "create",
    editingId: null,
    initialAllDay: true,
    identity: defaultIdentity(),
    plan: defaultPlan(),
    time: defaultTime(),
    windows: [],
    recurring: defaultRecurring(),
    recurrence: null,
    advanced: defaultAdvanced(),
    meta: defaultMeta(),
  };
}

// ---------- path setter ----------

function setDeepPath(
  state: QuickCreateState,
  path: string,
  value: unknown,
): QuickCreateState {
  // NOTE: if an intermediate segment is null/undefined or a non-object
  // primitive, the original state is returned unchanged. Callers must
  // initialise nested objects explicitly (e.g. via `buildDefaultQuickCreateState`)
  // before assigning to a deep path. Array-index path segments are not
  // supported and are intentionally out of scope here.
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
  const updated = setDeepPath(
    next as QuickCreateState,
    rest.join("."),
    value,
  );
  return { ...state, [head]: updated } as QuickCreateState;
}

// ---------- store ----------

export const useQuickCreateStore = create<QuickCreateState>()((set) => ({
  ...buildDefaultQuickCreateState(),
  open: () => set({ isOpen: true }),
  openCreate: (options?: { initialAllDay?: boolean }) =>
    set((state) => ({
      isOpen: true,
      mode: "create" as const,
      editingId: null,
      initialAllDay: options?.initialAllDay ?? state.initialAllDay,
    })),
  openEdit: (eventId: string) =>
    set({ isOpen: true, mode: "edit", editingId: eventId }),
  close: () => set({ isOpen: false, mode: "create", editingId: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setField: (path, value) => set((state) => setDeepPath(state, path, value)),
  reset: () =>
    set((state) => ({
      ...buildDefaultQuickCreateState(),
      // Preserve the current open/close state — `reset` only clears form
      // fields, it does not dismiss the panel.
      isOpen: state.isOpen,
    })),
  loadFromEvent: (event) =>
    set(() => ({
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
        durationMinMax: {
          minMs: 30 * 60_000,
          maxMs: 30 * 60_000,
        },
      },
      meta: {
        project: event.project ?? null,
        tags: Array.isArray(event.tags) ? event.tags : [],
        memo: event.memo ?? "",
      },
    })),
}));
