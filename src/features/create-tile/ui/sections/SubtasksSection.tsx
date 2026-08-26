"use client";

import {
  ActionIcon,
  Checkbox,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuItem,
  FloatingMenuSeparator,
  FloatingMenuTrigger,
} from "@/shared/ui/floating-menu";
import { FormRow } from "@/shared/ui/form";

import { TaskDefinitionEditorModal } from "../TaskDefinitionEditorModal";

interface SubtasksSectionProps {
  testId?: string;
  /** i18n key for the section heading. */
  headingKey?: string;
  /** i18n key for the inviting empty-state hint. */
  emptyHintKey?: string;
  /** i18n key for the empty-state CTA button. */
  addFirstKey?: string;
  /** i18n key for the underline add-input placeholder. */
  addPlaceholderKey?: string;
  /** i18n key for the per-existing-subtask title input aria-label. */
  titleAriaKey?: string;
  /** i18n key for the per-row menu trigger aria-label. */
  menuAriaKey?: string;
  /** i18n key for the menu item: move up. */
  moveUpKey?: string;
  /** i18n key for the menu item: move down. */
  moveDownKey?: string;
  /** i18n key for the menu item: edit. */
  editKey?: string;
  /** i18n key for the menu item: duplicate. */
  duplicateKey?: string;
  /** i18n key for the menu item: delete. */
  deleteKey?: string;
  /** i18n key for the remove-subtask button aria-label. */
  removeAriaKey?: string;
  /** i18n key for the per-row done checkbox aria-label. */
  doneAriaKey?: string;
  /** i18n key for the per-row undone checkbox aria-label. */
  undoneAriaKey?: string;
  /** i18n key for the progress text (parameterised `{done}` / `{total}`). */
  progressKey?: string;
  /**
   * Skip the outer `<div className="px-4 py-3">` wrapper so the section
   * can be dropped into a container that already owns its padding
   * (e.g. SubPanelShell's body).
   */
  bare?: boolean;
}

/**
 * Subtasks section — shared across the specialized workflow forms.
 *
 * Renders the existing `plan.completion.tasks[]` as a compact list
 * (checkbox + title + overflow menu) and an underline-only "Add a
 * sub-task" affordance that opens the full `TaskDefinitionEditorModal`
 * for structured creation. The modal is also reused per-row for the
 * "Edit" menu action — both flow through the same Zustand actions
 * (`addTask`, `setTaskField`, `reorderTasks`, `duplicateTask`,
 * `removeTask`, `toggleTaskDone`).
 */
export function SubtasksSection({
  testId = "subtasks-section",
  headingKey = "quickCreate.subtasksLabel",
  emptyHintKey = "quickCreate.subtasksEmptyHint",
  addFirstKey = "quickCreate.subtasksAddFirst",
  addPlaceholderKey = "quickCreate.subtaskAddPlaceholder",
  titleAriaKey = "quickCreate.subtaskTitleAria",
  menuAriaKey = "quickCreate.subtaskMenuAria",
  moveUpKey = "quickCreate.subtaskMoveUp",
  moveDownKey = "quickCreate.subtaskMoveDown",
  editKey = "quickCreate.subtaskEdit",
  duplicateKey = "quickCreate.subtaskDuplicate",
  deleteKey = "quickCreate.subtaskDelete",
  removeAriaKey = "quickCreate.subtaskRemoveAria",
  doneAriaKey = "quickCreate.subtaskDoneAria",
  undoneAriaKey = "quickCreate.subtaskUndoneAria",
  progressKey = "quickCreate.subtasksProgress",
  bare = false,
}: SubtasksSectionProps) {
  const { t } = useTranslation();
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const reorderTasks = useQuickCreateStore((s) => s.reorderTasks);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);
  const toggleTaskDone = useQuickCreateStore((s) => s.toggleTaskDone);
  const duplicateTask = useQuickCreateStore((s) => s.duplicateTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);

  const doneCount = tasks.filter((task) => task.done).length;

  const progressText =
    tasks.length > 0
      ? t(progressKey, { done: doneCount, total: tasks.length })
      : "";

  const openCreate = () => setCreatingOpen(true);
  const openEdit = (taskId: string) => setEditingTaskId(taskId);
  const closeModal = () => {
    setCreatingOpen(false);
    setEditingTaskId(null);
  };

  const modalTestId = `${testId}-modal`;

  const sectionBody = (
    <FormRow icon={<ListChecks className="h-4 w-4" aria-hidden />} className="items-start">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">
            {t(headingKey)}
          </span>
          {tasks.length > 0 && (
            <Text
              size="sm"
              c="dimmed"
              data-testid={`${testId}-progress`}
            >
              {progressText}
            </Text>
          )}
        </div>

        <Stack gap={2}>
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                data-testid={`${testId}-row-${task.id}`}
                className="flex items-center gap-2"
              >
                <Checkbox
                  size="sm"
                  checked={task.done}
                  onChange={() => toggleTaskDone(task.id)}
                  aria-label={
                    task.done
                      ? t(undoneAriaKey)
                      : t(doneAriaKey)
                  }
                  data-testid={`${testId}-row-${task.id}-checkbox`}
                />
                <TextInput
                  value={task.content.title}
                  onChange={(e) =>
                    setTaskField(task.id, "content.title", e.currentTarget.value)
                  }
                  size="sm"
                  className={
                    task.done
                      ? "flex-1 line-through text-dimmed"
                      : "flex-1"
                  }
                  aria-label={t(titleAriaKey)}
                  data-testid={`${testId}-row-${task.id}-title`}
                />
                <FloatingMenu>
                  <FloatingMenuTrigger asChild>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label={t(menuAriaKey)}
                      data-testid={`${testId}-row-${task.id}-menu-trigger`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                    </ActionIcon>
                  </FloatingMenuTrigger>
                  <FloatingMenuContent align="end" sideOffset={4}>
                    <FloatingMenuItem
                      disabled={idx === 0}
                      onClick={() => reorderTasks(idx, idx - 1)}
                      data-testid={`${testId}-row-${task.id}-menu-move-up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      <span>{t(moveUpKey)}</span>
                    </FloatingMenuItem>
                    <FloatingMenuItem
                      disabled={idx === tasks.length - 1}
                      onClick={() => reorderTasks(idx, idx + 1)}
                      data-testid={`${testId}-row-${task.id}-menu-move-down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      <span>{t(moveDownKey)}</span>
                    </FloatingMenuItem>
                    <FloatingMenuItem
                      onClick={() => openEdit(task.id)}
                      data-testid={`${testId}-row-${task.id}-menu-edit`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      <span>{t(editKey)}</span>
                    </FloatingMenuItem>
                    <FloatingMenuItem
                      onClick={() => duplicateTask(task.id)}
                      data-testid={`${testId}-row-${task.id}-menu-duplicate`}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      <span>{t(duplicateKey)}</span>
                    </FloatingMenuItem>
                    <FloatingMenuSeparator />
                    <FloatingMenuItem
                      onClick={() => removeTask(task.id)}
                      data-testid={`${testId}-row-${task.id}-menu-delete`}
                      data-danger=""
                      aria-label={t(removeAriaKey)}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span>{t(deleteKey)}</span>
                    </FloatingMenuItem>
                  </FloatingMenuContent>
                </FloatingMenu>
              </div>
            ))}
          </Stack>

        <button
          type="button"
          onClick={openCreate}
          data-testid={`${testId}-add`}
          className="mt-1 inline-flex items-center gap-1 self-start border-0 bg-transparent px-0 py-0.5 text-xs text-foreground-muted hover:text-foreground"
        >
          <Plus className="h-3 w-3" aria-hidden />
          {t(addPlaceholderKey)}
        </button>
      </div>

      <TaskDefinitionEditorModal
        taskId={editingTaskId}
        opened={creatingOpen || editingTaskId !== null}
        onClose={closeModal}
        testIdSuffix={modalTestId}
      />
    </FormRow>
  );

  return bare ? (
    <FormRow
      data-testid={testId}
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      className="items-start"
    >
      {sectionBody}
    </FormRow>
  ) : (
    <div className="px-4 py-3" data-testid={testId}>
      {sectionBody}
    </div>
  );
}
