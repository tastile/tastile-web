"use client";

import { Button, Stack, Text, TextInput } from "@mantine/core";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";

interface SubtasksSectionProps {
  testId?: string;
  /** i18n key for the section heading. */
  headingKey?: string;
  /** Fallback heading label when i18n unavailable. */
  fallbackHeading?: string;
  /** i18n key for the empty-state hint shown when no subtasks exist. */
  emptyKey?: string;
  /** Fallback empty-state hint. */
  fallbackEmpty?: string;
  /** i18n key for the "Add a subtask" placeholder. */
  addPlaceholderKey?: string;
  /** Fallback placeholder for the new-subtask input. */
  fallbackAddPlaceholder?: string;
  /** i18n key for the per-existing-subtask title input aria-label. */
  titleAriaKey?: string;
  /** Fallback aria for the title input. */
  fallbackTitleAria?: string;
  /** i18n key for the remove-subtask button aria-label. */
  removeAriaKey?: string;
  /** Fallback aria for the remove button. */
  fallbackRemoveAria?: string;
  /** i18n key for the add-subtask button aria-label. */
  addAriaKey?: string;
  /** Fallback aria for the add button. */
  fallbackAddAria?: string;
}

/**
 * Subtasks section — shared across the specialized workflow forms.
 *
 * Extracted from the legacy TaskDetailsSubPanel subtask editor so all
 * workflows (Task / Event / Recurring) can edit the same
 * `plan.completion.tasks[]` array in the main body. The sub-panel
 * editors still render their own (advanced) lists for users who haven't
 * adopted the new layout; this section is the canonical entry point.
 *
 * Reads `plan.completion.tasks` from the store and writes via
 * `addTask` / `removeTask` / `setTaskField`. Wrapped in `px-4 py-3`
 * so consumers can drop it in directly between the `DetailsAffordanceButton`
 * and the `ProjectColorRow`.
 */
export function SubtasksSection({
  testId = "subtasks-section",
  headingKey = "quickCreate.subtasksLabel",
  fallbackHeading = "Sub-tasks",
  emptyKey = "quickCreate.subtasksEmpty",
  fallbackEmpty = "No sub-tasks yet",
  addPlaceholderKey = "quickCreate.subtaskAddPlaceholder",
  fallbackAddPlaceholder = "Add a sub-task",
  titleAriaKey = "quickCreate.subtaskTitleAria",
  fallbackTitleAria = "Sub-task title",
  removeAriaKey = "quickCreate.subtaskRemoveAria",
  fallbackRemoveAria = "Remove sub-task",
  addAriaKey = "quickCreate.subtaskAddAria",
  fallbackAddAria = "Add sub-task",
}: SubtasksSectionProps) {
  const { t } = useTranslation();
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);

  const [newTaskTitle, setNewTaskTitle] = useState("");

  return (
    <div className="px-4 py-3" data-testid={testId}>
      <FormRow icon={<ListChecks className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t(headingKey) || fallbackHeading}</span>
          <Stack gap={2}>
            {tasks.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid={`${testId}-empty`}>
                {t(emptyKey) || fallbackEmpty}
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
                    aria-label={t(titleAriaKey) || fallbackTitleAria}
                  />
                  <Button
                    type="button"
                    variant="subtle"
                    size="xs"
                    color="red"
                    onClick={() => removeTask(task.id)}
                    aria-label={t(removeAriaKey) || fallbackRemoveAria}
                    data-testid={`${testId}-remove-${task.id}`}
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
              placeholder={t(addPlaceholderKey) || fallbackAddPlaceholder}
              size="xs"
              className="flex-1"
              data-testid={`${testId}-new-subtask`}
            />
            <Button
              type="submit"
              variant="light"
              size="xs"
              aria-label={t(addAriaKey) || fallbackAddAria}
              data-testid={`${testId}-add`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </form>
        </div>
      </FormRow>
    </div>
  );
}
