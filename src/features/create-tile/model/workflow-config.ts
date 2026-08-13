/**
 * WorkflowKind — the four peer creation editors for QuickCreate.
 *
 * Each `WorkflowKind` maps to a distinct creation UI:
 *   - event     → QuickCreateEvent (specialized form)
 *   - task      → QuickCreateTask (specialized form)
 *   - recurring → QuickCreateRecurring (specialized form)
 *   - detailed  → QuickCreate (original 7-section monolithic editor)
 *
 * The four editors are peers, not a hierarchy — `detailed` is not a
 * "legacy" or "fallback"; it is the original full-fidelity editor that
 * exposes every v1 slice at once. The user selects which editor to
 * open with via the WorkflowChip dropdown. The wire payload is shared
 * across all four editors (single store schema).
 */
import type { PlanRoleValue, TileKindValue } from "@/shared/model/v1/constants";
import { PlanRole, TileKind } from "@/shared/model/v1/constants";
import type { RepeatChoice } from "@/shared/stores/quick-create-store";
import { CalendarDays, CheckSquare, Layers, type LucideIcon, Repeat } from "lucide-react";

export type WorkflowKind = "event" | "task" | "recurring" | "detailed";

export interface WorkflowConfig {
  id: WorkflowKind;
  icon: LucideIcon;
  /** i18n key for the heading text shown in create mode. */
  headingKeyCreate: string;
  /** i18n key for the heading text shown in edit mode. */
  headingKeyEdit: string;
  /** i18n key for the menu item label. */
  menuLabelKey: string;
  /** i18n key for the menu item 1-line description. */
  menuDescriptionKey: string;
  /** Default TileKind the wire payload will carry. */
  defaultTileKind: TileKindValue;
  /** Default PlanRole the wire payload will carry (overridable per-form). */
  defaultPlanRole: PlanRoleValue;
  /** Default repeatMode applied when the form opens. */
  defaultRepeatMode: RepeatChoice;
}

export const WORKFLOW_CONFIG: Record<WorkflowKind, WorkflowConfig> = {
  event: {
    id: "event",
    icon: CalendarDays,
    headingKeyCreate: "titleCreateEvent",
    headingKeyEdit: "titleEditEvent",
    menuLabelKey: "menuEventLabel",
    menuDescriptionKey: "menuEventDescription",
    defaultTileKind: TileKind.PLACEMENT,
    defaultPlanRole: PlanRole.EXECUTABLE,
    defaultRepeatMode: "once",
  },
  task: {
    id: "task",
    icon: CheckSquare,
    headingKeyCreate: "titleCreateTask",
    headingKeyEdit: "titleEditTask",
    menuLabelKey: "menuTaskLabel",
    menuDescriptionKey: "menuTaskDescription",
    defaultTileKind: TileKind.PLACEMENT,
    defaultPlanRole: PlanRole.EXECUTABLE,
    defaultRepeatMode: "once",
  },
  recurring: {
    id: "recurring",
    icon: Repeat,
    headingKeyCreate: "titleCreateRecurring",
    headingKeyEdit: "titleEditRecurring",
    menuLabelKey: "menuRecurringLabel",
    menuDescriptionKey: "menuRecurringDescription",
    defaultTileKind: TileKind.RECURRING,
    defaultPlanRole: PlanRole.EXECUTABLE,
    defaultRepeatMode: "daily",
  },
  detailed: {
    id: "detailed",
    icon: Layers,
    headingKeyCreate: "titleCreateDetailed",
    headingKeyEdit: "titleEditDetailed",
    menuLabelKey: "menuDetailedLabel",
    menuDescriptionKey: "menuDetailedDescription",
    defaultTileKind: TileKind.PLACEMENT,
    defaultPlanRole: PlanRole.EXECUTABLE,
    defaultRepeatMode: "once",
  },
};

export const WORKFLOW_ORDER: readonly WorkflowKind[] = [
  "event",
  "task",
  "recurring",
  "detailed",
] as const;
