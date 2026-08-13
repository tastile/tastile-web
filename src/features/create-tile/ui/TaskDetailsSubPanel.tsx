"use client";

import { Button, Stack, Text, TextInput } from "@mantine/core";
import { Link2, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { SubPanelShell } from "./SubPanelShell";

export interface TaskDetailsSubPanelProps {
  opened: boolean;
  onClose: () => void;
  durationMinMs: number | null;
  durationMaxMs: number | null;
}

/**
 * Task-specific details sub-panel. Surfaces the "advanced" fields the
 * base view intentionally omits — sub-task checklist and the linked-
 * tile references. Kept intentionally minimal so the panel stays out
 * of the way of the common flow.
 */
export function TaskDetailsSubPanel({
  opened,
  onClose,
  durationMinMs,
  durationMaxMs,
}: TaskDetailsSubPanelProps) {
  const { t } = useTranslation();
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);
  const setField = useQuickCreateStore((s) => s.setField);

  const [newTaskTitle, setNewTaskTitle] = useState("");

  return (
    <SubPanelShell
      panelKey="task-details"
      activeKey={activePanel}
      onClose={onClose}
      headingId="task-details-heading"
      title={t("quickCreate.detailsTaskTitle") || "Task details"}
      description={t("quickCreate.detailsSubDescription") || ""}
      layout="drawer"
    >
      <Stack gap="md">
        <FormRow icon={<ListChecks className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.subtasksLabel") || "Sub-tasks"}</span>
            <Stack gap={2}>
              {tasks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("quickCreate.subtasksEmpty") || "No sub-tasks yet"}
                </Text>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <TextInput
                      value={task.content.title}
                      onChange={(e) =>
                        setTaskField(task.id, "content.title", e.currentTarget.value)
                      }
                      size="xs"
                      className="flex-1"
                      aria-label={t("quickCreate.subtaskTitleAria") || "Sub-task title"}
                    />
                    <Button
                      type="button"
                      variant="subtle"
                      size="xs"
                      color="red"
                      onClick={() => removeTask(task.id)}
                      aria-label={t("quickCreate.subtaskRemoveAria") || "Remove sub-task"}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                ))
              )}
            </Stack>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newTaskTitle.trim();
                if (!trimmed) return;
                addTask(trimmed);
                setNewTaskTitle("");
              }}
              className="flex items-center gap-2"
            >
              <TextInput
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.currentTarget.value)}
                placeholder={t("quickCreate.subtaskAddPlaceholder") || "Add a sub-task"}
                size="xs"
                className="flex-1"
                data-testid="task-details-new-subtask"
              />
              <Button
                type="submit"
                variant="light"
                size="xs"
                aria-label={t("quickCreate.subtaskAddAria") || "Add sub-task"}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </form>
          </div>
        </FormRow>

        <FormRow icon={<Link2 className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.timeRequirementLabel") || "Time requirement"}</span>
            <Text size="sm" c="dimmed">
              {durationMinMs == null
                ? t("quickCreate.durationNoneTitle") || "No required duration"
                : `${Math.round((durationMinMs ?? 0) / 60_000)} min`}
            </Text>
            <Text size="xs" c="dimmed">
              {t("quickCreate.durationNoneSub") ||
                "Adjust the base form duration chip to change this."}
            </Text>
          </div>
        </FormRow>

        <FormRow icon={null}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setField("plan.references", []);
            }}
            data-testid="task-details-clear-refs"
          >
            {t("quickCreate.detailsClearReferences") || "Clear references"}
          </Button>
        </FormRow>
      </Stack>
    </SubPanelShell>
  );
}
