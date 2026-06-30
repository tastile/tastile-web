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
import type { RecurrenceModel } from "@/lib/domain/tile";
import type { TaskDefinition, TimeRequirement } from "@/lib/domain/v1/completion";
import { PlanRole, RecurringState, TileKind, type TileKindValue } from "@/lib/domain/v1/constants";
import type { FrameRule, Plan, Recurring } from "@/lib/domain/v1/tile";
import type { DurationRange, Span, Window } from "@/lib/domain/v1/window";

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
   * Non-null when `loadFromRecurringTile` could not fetch the tile (e.g.
   * the recurring-tile GET returned 404 because the template does not
   * exist in the backing store). The panel surfaces this as a banner so
   * the user sees why hydration failed instead of a silent no-op. Cleared
   * on the next successful load.
   */
  loadError: string | null;
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
  loadFromEvent: (event: import("@/lib/domain/calendar").CalendarEvent) => void;
  /**
   * Hydrate the form from an existing recurring Tile so the panel can be
   * reused for editing. Opens the panel FIRST (mode="edit", editingId=tileId,
   * loadError=null) so the user always sees visual feedback, then fetches
   * the full v7 Tile via getTile(id) and maps the relevant condition
   * layers (core → identity, temporal → time, annotation → meta,
   * objective.recurrence → recurrence) into the store. On fetch failure,
   * surfaces a `loadError` string the panel renders as a banner so the
   * user understands why the form is empty; edits still save against the
   * given tileId. Returns the fetched Tile on success or null on error.
   */
  loadFromRecurringTile: (tileId: string) => Promise<unknown | null>;
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
    id: `tr_${Math.random().toString(36).slice(2, 9)}`,
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

export function defaultRecurrenceModel(): RecurrenceModel {
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
  | "loadError"
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
    loadError: null,
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

function setDeepPath(state: QuickCreateState, path: string, value: unknown): QuickCreateState {
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
  const updated = setDeepPath(next as QuickCreateState, rest.join("."), value);
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
  openEdit: (eventId: string) => set({ isOpen: true, mode: "edit", editingId: eventId }),
  close: () => set({ isOpen: false, mode: "create", editingId: null, loadError: null }),
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
  loadFromRecurringTile: async (tileId: string) => {
    // Open the panel FIRST so the user always sees visual feedback —
    // a silent no-op when the GET fails is the worst UX for an edit
    // flow. We seed defaults, mark the panel as editing this id, and
    // clear any previous load error. The actual hydration happens after.
    set({
      isOpen: true,
      mode: "edit" as const,
      editingId: tileId,
      loadError: null,
      // Default to RECURRING (kind=0) so the radio lands on 定期 even
      // when the GET fails — the caller knows this is a recurring tile
      // (ScheduleMain passes template.id from the Recurring Templates
      // list). Hydration below may override based on the fetched tile.
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
      // Lazy import: endpoints.ts is on the consumer side of this store
      // (it imports submit.ts → quick-create-store), so a top-level
      // static import here would create a circular dependency.
      const { getCoreClient } = await import("@/lib/api/endpoints");
      const res = await getCoreClient().call<unknown>("getTile", {
        pathParams: { id: tileId },
      });
      if (!res.ok || !res.data) {
        const detail = !res.ok
          ? `status=${res.error.kind} ${res.error.message ?? ""}`.trim()
          : "empty response";
        set({
          loadError: `Failed to load recurring tile ${tileId} (${detail}). The panel is open in edit mode with default values; edits will be saved to ${tileId}.`,
        });
        return null;
      }
      // The v1 endpoint `GET /v1/tiles/{id}` returns a flat `TileView`
      // (v1-domain read view). Fields are snake_case in JSON. The labels
      // / span / recurrence edits are NOT supported yet because the v1
      // backend does not expose an aggregate-detail endpoint; populate
      // only what the read API actually returns.
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
        // TODO: restore when /v1/tiles/{id}/detail returns labels + recurrence.
        meta: {
          project: null,
          tags: [],
          memo: "",
        },
        recurrence: null,
      });
      return tile;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        loadError: `Failed to load recurring tile ${tileId}: ${msg}. The panel is open in edit mode with default values.`,
      });
      return null;
    }
  },
}));
