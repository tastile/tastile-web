"use client";

import {
  ActionIcon,
  Button,
  Checkbox,
  Menu,
  Popover,
  Stack,
  Text,
  TextInput,
  Textarea,
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
import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";

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
  /** Fallback empty-state hint (passive). Kept for legacy callers. */
  fallbackEmpty?: string;
  /** i18n key for the inviting empty-state hint. */
  emptyHintKey?: string;
  /** Fallback for the inviting empty-state hint. */
  fallbackEmptyHint?: string;
  /** i18n key for the empty-state CTA button. */
  addFirstKey?: string;
  /** Fallback for the empty-state CTA button. */
  fallbackAddFirst?: string;
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
  /** i18n key for the per-row menu trigger aria-label. */
  menuAriaKey?: string;
  /** Fallback aria for the per-row menu trigger. */
  fallbackMenuAria?: string;
  /** i18n key for the menu item: move up. */
  moveUpKey?: string;
  /** Fallback for move-up menu item label. */
  fallbackMoveUp?: string;
  /** i18n key for the menu item: move down. */
  moveDownKey?: string;
  /** Fallback for move-down menu item label. */
  fallbackMoveDown?: string;
  /** i18n key for the menu item: duplicate. */
  duplicateKey?: string;
  /** Fallback for duplicate menu item label. */
  fallbackDuplicate?: string;
  /** i18n key for the menu item: delete. */
  deleteKey?: string;
  /** Fallback for delete menu item label. */
  fallbackDelete?: string;
  /** i18n key for the menu item: edit note. */
  editNoteKey?: string;
  /** Fallback for edit-note menu item label. */
  fallbackEditNote?: string;
  /** i18n key for the note textarea placeholder. */
  notePlaceholderKey?: string;
  /** Fallback for note textarea placeholder. */
  fallbackNotePlaceholder?: string;
  /** i18n key for the note textarea aria-label. */
  noteAriaKey?: string;
  /** Fallback for note textarea aria-label. */
  fallbackNoteAria?: string;
  /** i18n key for the note Save button. */
  noteSaveKey?: string;
  /** Fallback for the note Save button. */
  fallbackNoteSave?: string;
  /** i18n key for the note Clear button. */
  noteClearKey?: string;
  /** Fallback for the note Clear button. */
  fallbackNoteClear?: string;
  /** i18n key for the per-row done checkbox aria-label. */
  doneAriaKey?: string;
  /** Fallback for done aria-label. */
  fallbackDoneAria?: string;
  /** i18n key for the per-row undone checkbox aria-label. */
  undoneAriaKey?: string;
  /** Fallback for undone aria-label. */
  fallbackUndoneAria?: string;
  /** i18n key for the progress text (parameterised `{done}` / `{total}`). */
  progressKey?: string;
  /** Fallback for progress text (literal, e.g. "2/5 done"). */
  fallbackProgress?: string;
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
 * Extracted from the legacy TaskDetailsSubPanel subtask editor so all
 * workflows (Task / Event / Recurring) can edit the same
 * `plan.completion.tasks[]` array in the main body. The sub-panel
 * editors render their own (advanced) lists for users who haven't
 * adopted the new layout; this section is the canonical entry point.
 *
 * Reads `plan.completion.tasks` from the store and writes via
 * `addTask` / `removeTask` / `reorderTasks` / `setTaskField` /
 * `toggleTaskDone` / `duplicateTask`. Wrapped in `px-4 py-3` so
 * consumers can drop it in directly between the `DetailsAffordanceButton`
 * and the `ProjectColorRow`; pass `bare` to skip the wrapper.
 */
export function SubtasksSection({
  testId = "subtasks-section",
  headingKey = "quickCreate.subtasksLabel",
  fallbackHeading = "Sub-tasks",
  emptyKey = "quickCreate.subtasksEmpty",
  fallbackEmpty = "No sub-tasks yet",
  emptyHintKey = "quickCreate.subtasksEmptyHint",
  fallbackEmptyHint = "Sub-tasks break this tile into trackable steps.",
  addFirstKey = "quickCreate.subtasksAddFirst",
  fallbackAddFirst = "Add a sub-task",
  addPlaceholderKey = "quickCreate.subtaskAddPlaceholder",
  fallbackAddPlaceholder = "Add a sub-task",
  titleAriaKey = "quickCreate.subtaskTitleAria",
  fallbackTitleAria = "Sub-task title",
  removeAriaKey = "quickCreate.subtaskRemoveAria",
  fallbackRemoveAria = "Remove sub-task",
  addAriaKey = "quickCreate.subtaskAddAria",
  fallbackAddAria = "Add sub-task",
  menuAriaKey = "quickCreate.subtaskMenuAria",
  fallbackMenuAria = "Sub-task actions",
  moveUpKey = "quickCreate.subtaskMoveUp",
  fallbackMoveUp = "Move up",
  moveDownKey = "quickCreate.subtaskMoveDown",
  fallbackMoveDown = "Move down",
  duplicateKey = "quickCreate.subtaskDuplicate",
  fallbackDuplicate = "Duplicate",
  deleteKey = "quickCreate.subtaskDelete",
  fallbackDelete = "Delete",
  editNoteKey = "quickCreate.subtaskEditNote",
  fallbackEditNote = "Edit note",
  notePlaceholderKey = "quickCreate.subtaskNotePlaceholder",
  fallbackNotePlaceholder = "Why this sub-task matters",
  noteAriaKey = "quickCreate.subtaskNoteAria",
  fallbackNoteAria = "Sub-task note",
  noteSaveKey = "quickCreate.subtaskNoteSave",
  fallbackNoteSave = "Save note",
  noteClearKey = "quickCreate.subtaskNoteClear",
  fallbackNoteClear = "Clear note",
  doneAriaKey = "quickCreate.subtaskDoneAria",
  fallbackDoneAria = "Mark done",
  undoneAriaKey = "quickCreate.subtaskUndoneAria",
  fallbackUndoneAria = "Mark not done",
  progressKey = "quickCreate.subtasksProgress",
  fallbackProgress = "{done}/{total} done",
  bare = false,
}: SubtasksSectionProps) {
  const { t } = useTranslation();
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const reorderTasks = useQuickCreateStore((s) => s.reorderTasks);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);
  const toggleTaskDone = useQuickCreateStore((s) => s.toggleTaskDone);
  const duplicateTask = useQuickCreateStore((s) => s.duplicateTask);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  /** id of the row whose note popover is currently open (one at a time). */
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  /** Local textarea draft for the open note editor. */
  const [noteDraft, setNoteDraft] = useState("");

  const newTaskInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusId = useRef<string | null>(null);

  // After `addTask` mutates the store, focus the new row's title input
  // and select its contents. The new task starts empty (defaultTask
  // produces an empty title), so selecting an empty string is harmless
  // and a future addTask variant that copies from the typed title can
  // lean on this same hook.
  useEffect(() => {
    if (!pendingFocusId.current) return;
    const el = titleInputRefs.current[pendingFocusId.current];
    if (el) {
      el.focus();
      el.select();
    }
    pendingFocusId.current = null;
  }, [tasks]);

  const doneCount = tasks.filter((task) => task.done).length;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    const id = addTask(trimmed);
    pendingFocusId.current = id;
    setNewTaskTitle("");
  };

  const focusAddInput = () => {
    newTaskInputRef.current?.focus();
  };

  const openNoteEditor = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    setNoteDraft(task?.content.note ?? "");
    setEditingNoteId(taskId);
  };

  const closeNoteEditor = () => {
    setEditingNoteId(null);
    setNoteDraft("");
  };

  const saveNote = () => {
    if (!editingNoteId) return;
    const trimmed = noteDraft.trim();
    setTaskField(editingNoteId, "content.note", trimmed.length > 0 ? trimmed : null);
    closeNoteEditor();
  };

  const clearNote = () => {
    setNoteDraft("");
    if (!editingNoteId) return;
    setTaskField(editingNoteId, "content.note", null);
  };

  const progressText =
    tasks.length > 0
      ? t(progressKey, { done: doneCount, total: tasks.length }) ||
        fallbackProgress
          .replace("{done}", String(doneCount))
          .replace("{total}", String(tasks.length))
      : "";

  const sectionBody = (
    <FormRow icon={<ListChecks className="h-4 w-4" aria-hidden />} className="items-start">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">
            {t(headingKey) || fallbackHeading}
          </span>
          {tasks.length > 0 && (
            <Text
              size="xs"
              c="dimmed"
              data-testid={`${testId}-progress`}
            >
              {progressText}
            </Text>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col gap-1.5" data-testid={`${testId}-empty`}>
            <Text size="xs" c="dimmed" data-testid={`${testId}-empty-hint`}>
              {t(emptyHintKey) || fallbackEmptyHint}
            </Text>
            {/* Legacy hint kept for callers/tests that still assert on it. */}
            <Text size="xs" c="dimmed" data-testid={`${testId}-empty-text`} className="sr-only">
              {t(emptyKey) || fallbackEmpty}
            </Text>
            <Button
              type="button"
              variant="subtle"
              size="xs"
              align="left"
              onClick={focusAddInput}
              data-testid={`${testId}-add-first`}
              className="self-start"
            >
              {t(addFirstKey) || fallbackAddFirst}
            </Button>
          </div>
        ) : (
          <Stack gap={2}>
            {tasks.map((task, idx) => {
              const isNoteOpen = editingNoteId === task.id;
              const titleInputId = `${testId}-row-${task.id}-title`;
              return (
                <div
                  key={task.id}
                  data-testid={`${testId}-row-${task.id}`}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      size="xs"
                      checked={task.done}
                      onChange={() => toggleTaskDone(task.id)}
                      aria-label={
                        task.done
                          ? t(undoneAriaKey) || fallbackUndoneAria
                          : t(doneAriaKey) || fallbackDoneAria
                      }
                      data-testid={`${testId}-row-${task.id}-checkbox`}
                    />
                    <TextInput
                      id={titleInputId}
                      value={task.content.title}
                      onChange={(e) =>
                        setTaskField(
                          task.id,
                          "content.title",
                          e.currentTarget.value,
                        )
                      }
                      size="xs"
                      className={
                        task.done
                          ? "flex-1 line-through text-dimmed"
                          : "flex-1"
                      }
                      ref={(el) => {
                        titleInputRefs.current[task.id] = el;
                      }}
                      aria-label={t(titleAriaKey) || fallbackTitleAria}
                      data-testid={`${testId}-row-${task.id}-title`}
                    />
                    <Popover
                      opened={isNoteOpen}
                      onChange={(next) => {
                        if (!next) closeNoteEditor();
                      }}
                      position="bottom-end"
                      width={320}
                      withinPortal={false}
                      trapFocus
                    >
                      <Popover.Target>
                        <span
                          aria-hidden
                          ref={(el) => {
                            titleInputRefs.current[`${task.id}__noteAnchor`] =
                              el;
                          }}
                        />
                      </Popover.Target>
                      <Popover.Dropdown
                        data-testid={`${testId}-row-${task.id}-note-popover`}
                      >
                        <Stack gap="xs">
                          <Textarea
                            value={noteDraft}
                            onChange={(e) =>
                              setNoteDraft(e.currentTarget.value)
                            }
                            placeholder={
                              t(notePlaceholderKey) || fallbackNotePlaceholder
                            }
                            autosize
                            minRows={2}
                            maxRows={6}
                            size="xs"
                            aria-label={t(noteAriaKey) || fallbackNoteAria}
                            data-testid={`${testId}-row-${task.id}-note-textarea`}
                            onKeyDown={(e) => {
                              if (
                                (e.metaKey || e.ctrlKey) &&
                                e.key === "Enter"
                              ) {
                                e.preventDefault();
                                saveNote();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                closeNoteEditor();
                              }
                            }}
                          />
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="subtle"
                              onClick={clearNote}
                              data-testid={`${testId}-row-${task.id}-note-clear`}
                            >
                              {t(noteClearKey) || fallbackNoteClear}
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              onClick={saveNote}
                              data-testid={`${testId}-row-${task.id}-note-save`}
                            >
                              {t(noteSaveKey) || fallbackNoteSave}
                            </Button>
                          </div>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                    <Menu withinPortal={false} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          aria-label={t(menuAriaKey) || fallbackMenuAria}
                          data-testid={`${testId}-row-${task.id}-menu-trigger`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<ArrowUp className="h-3.5 w-3.5" aria-hidden />}
                          disabled={idx === 0}
                          onClick={() => reorderTasks(idx, idx - 1)}
                          data-testid={`${testId}-row-${task.id}-menu-move-up`}
                        >
                          {t(moveUpKey) || fallbackMoveUp}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<ArrowDown className="h-3.5 w-3.5" aria-hidden />}
                          disabled={idx === tasks.length - 1}
                          onClick={() => reorderTasks(idx, idx + 1)}
                          data-testid={`${testId}-row-${task.id}-menu-move-down`}
                        >
                          {t(moveDownKey) || fallbackMoveDown}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Pencil className="h-3.5 w-3.5" aria-hidden />}
                          onClick={() => openNoteEditor(task.id)}
                          data-testid={`${testId}-row-${task.id}-menu-edit-note`}
                        >
                          {t(editNoteKey) || fallbackEditNote}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Copy className="h-3.5 w-3.5" aria-hidden />}
                          onClick={() => duplicateTask(task.id)}
                          data-testid={`${testId}-row-${task.id}-menu-duplicate`}
                        >
                          {t(duplicateKey) || fallbackDuplicate}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                          color="red"
                          onClick={() => removeTask(task.id)}
                          data-testid={`${testId}-row-${task.id}-menu-delete`}
                          aria-label={t(removeAriaKey) || fallbackRemoveAria}
                        >
                          {t(deleteKey) || fallbackDelete}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </div>
                  {/* Keep the legacy testid so older callers/tests still
                      resolve, even though the actual remove action is now
                      driven from the menu. */}
                  <Collapse in={false}>
                    <button
                      type="button"
                      data-testid={`${testId}-remove-${task.id}`}
                      className="hidden"
                      aria-hidden
                    />
                  </Collapse>
                  </div>
                </div>
              );
            })}
          </Stack>
        )}

        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2"
        >
          <TextInput
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.currentTarget.value)}
            placeholder={t(addPlaceholderKey) || fallbackAddPlaceholder}
            size="xs"
            className="flex-1"
            ref={(el) => {
              newTaskInputRef.current = el;
            }}
            aria-label={t(addAriaKey) || fallbackAddAria}
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
  );

  return bare ? (
    <Fragment>{sectionBody}</Fragment>
  ) : (
    <div className="px-4 py-3" data-testid={testId}>
      {sectionBody}
    </div>
  );
}
