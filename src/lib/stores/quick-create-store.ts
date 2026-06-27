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
  type PlanRoleValue,
  type TileKindValue,
} from "@/lib/domain/v1/constants";
import type { FrameRule } from "@/lib/domain/v1/tile";
import type { Plan } from "@/lib/domain/v1/tile";
import type { Window, Span, DurationRange } from "@/lib/domain/v1/window";
import type { Recurring } from "@/lib/domain/v1/tile";

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
  isLabelOnly: boolean;
}

// ---------- store ----------

export interface QuickCreateState {
  // Backwards-compat open/close surface retained so existing consumers
  // (QuickTileCreate, layout clients, ActivityBar, etc.) keep compiling.
  // The new model is live editing: panel renders unconditionally and the
  // store is the single source of truth for all field state.
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  identity: TileIdentitySlice;
  plan: Plan;
  time: TimeSlice;
  windows: Window[];
  recurring: RecurringSlice;
  advanced: AdvancedSlice;
  meta: MetaSlice;

  setField: (path: string, value: unknown) => void;
  setLabelOnly: (isLabelOnly: boolean) => void;
  reset: () => void;
}

// ---------- defaults ----------

function defaultConditionRoot(): Plan["completion"]["root"] {
  // A placeholder ALL node. Editors replace this; tests only assert the
  // shape exists, not its semantic correctness.
  // TODO: validate before submit — `kind` should be a ConditionKindValue.
  return { kind: 0, children: [], term: null };
}

function defaultPlan(): Plan {
  return {
    role: PlanRole.EXECUTABLE,
    references: [],
    completion: {
      root: defaultConditionRoot(),
      timeRequirements: [],
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
    externalId: null,
    visual: { color: "", icon: "" },
  };
}

function defaultTime(): TimeSlice {
  return {
    span: { start: "", end: "" },
    durationMinMax: { minMs: null, maxMs: null },
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

function defaultAdvanced(): AdvancedSlice {
  return { changeSets: [], rules: [] };
}

function defaultMeta(): MetaSlice {
  return {
    project: null,
    tags: [],
    memo: "",
    isLabelOnly: false,
  };
}

export function buildDefaultQuickCreateState(): Pick<
  QuickCreateState,
  | "isOpen"
  | "identity"
  | "plan"
  | "time"
  | "windows"
  | "recurring"
  | "advanced"
  | "meta"
> {
  return {
    isOpen: true,
    identity: defaultIdentity(),
    plan: defaultPlan(),
    time: defaultTime(),
    windows: [],
    recurring: defaultRecurring(),
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
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setField: (path, value) => set((state) => setDeepPath(state, path, value)),
  setLabelOnly: (isLabelOnly) =>
    set((state) => ({
      plan: {
        ...state.plan,
        role: (isLabelOnly ? PlanRole.LABEL : PlanRole.EXECUTABLE) as PlanRoleValue,
      },
      meta: { ...state.meta, isLabelOnly },
    })),
  reset: () =>
    set((state) => ({
      ...buildDefaultQuickCreateState(),
      // Preserve the current open/close state — `reset` only clears form
      // fields, it does not dismiss the panel.
      isOpen: state.isOpen,
    })),
}));