"use client";

import {
  ActionIcon,
  Button,
  Checkbox,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/shared/i18n/use-translation";
import type { ConditionNode } from "@/shared/model/v1/condition";
import { ConditionKind } from "@/shared/model/v1/constants";
import { TaskOrderRelation } from "@/shared/model/v1/constants";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

import { ConditionEditor } from "./ConditionEditor";

interface DraftTask {
  title: string;
  note: string | null;
  done: boolean;
  show: ConditionNode | null;
  complete: ConditionNode;
  order: { id: string; relation: number; targetTaskId: string }[];
}

interface TaskDefinitionEditorModalProps {
  /**
   * When set, the modal edits the existing task with this id (the
   * initial form state is hydrated from the store). When omitted, the
   * modal creates a new task on submit.
   */
  taskId?: string | null;
  opened: boolean;
  onClose: () => void;
  /** Optional i18n namespace prefix. Defaults to `quickCreate`. */
  i18nPrefix?: string;
  /** Test seam — overrides the default modal testid. */
  testIdSuffix?: string;
}

function emptyDraft(complete: ConditionNode): DraftTask {
  return {
    title: "",
    note: null,
    done: false,
    show: null,
    complete,
    order: [],
  };
}

function defaultComplete(id: string): ConditionNode {
  return {
    kind: ConditionKind.TERM,
    children: [],
    term: { kind: "task", value: { taskId: id, state: 2 } },
  };
}

function freshOrderRule(targetTaskId: string): DraftTask["order"][number] {
  return {
    id: `rule_${Math.random().toString(36).slice(2, 9)}`,
    relation: TaskOrderRelation.BEFORE,
    targetTaskId,
  };
}

/**
 * Full TaskDefinition editor.
 *
 * Hosts every field a `TaskDefinition` can carry — title, note, the
 * authoring-time `done` flag, the optional `show` condition, the
 * `complete` condition, and the `order` rules. Used both for adding new
 * sub-tasks (from the SubtasksSection underline input) and editing
 * existing ones (from the per-row "Edit" menu item).
 *
 * On submit:
 *  - If `taskId` is set, the modal applies each field via
 *    `setTaskField(taskId, path, value)` so the existing task id is
 *    preserved.
 *  - Otherwise, the modal calls `addTask(title)` to mint a new id and
 *    then patches every other field onto the new task via `setTaskField`.
 */
export function TaskDefinitionEditorModal({
  taskId = null,
  opened,
  onClose,
  i18nPrefix = "quickCreate",
  testIdSuffix = "task-editor-modal",
}: TaskDefinitionEditorModalProps) {
  const { t } = useTranslation();
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);

  const existing = useMemo(
    () => (taskId ? tasks.find((task) => task.id === taskId) ?? null : null),
    [taskId, tasks],
  );

  const [draft, setDraft] = useState<DraftTask>(() => {
    if (existing) {
      return {
        title: existing.content.title,
        note: existing.content.note,
        done: existing.done,
        show: existing.show,
        complete: existing.complete,
        order: existing.order.map((rule) => ({
          id: rule.id,
          relation: rule.relation,
          targetTaskId: rule.targetTaskId,
        })),
      };
    }
    return emptyDraft(defaultComplete("__new__"));
  });

  // Hydrate the draft when the modal opens or the existing task changes.
  useEffect(() => {
    if (!opened) return;
    if (existing) {
      setDraft({
        title: existing.content.title,
        note: existing.content.note,
        done: existing.done,
        show: existing.show,
        complete: existing.complete,
        order: existing.order.map((rule) => ({
          id: rule.id,
          relation: rule.relation,
          targetTaskId: rule.targetTaskId,
        })),
      });
    } else {
      setDraft(emptyDraft(defaultComplete("__new__")));
    }
  }, [opened, existing]);

  const targetOptions = useMemo(() => {
    const options = tasks
      .filter((task) => task.id !== taskId)
      .map((task) => ({
        value: task.id,
        label: task.content.title || t(`${i18nPrefix}.taskUntitled`) || "Untitled",
      }));
    return options;
  }, [tasks, taskId, t, i18nPrefix]);

  const trimmedTitle = draft.title.trim();
  const canSubmit = trimmedTitle.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    let targetId = taskId;
    if (!targetId) {
      targetId = addTask(trimmedTitle);
    }
    if (!targetId) return;
    setTaskField(targetId, "content.title", trimmedTitle);
    setTaskField(targetId, "content.note", draft.note && draft.note.length > 0 ? draft.note : null);
    setTaskField(targetId, "done", draft.done);
    setTaskField(targetId, "show", draft.show);
    setTaskField(targetId, "complete", draft.complete);
    setTaskField(
      targetId,
      "order",
      draft.order
        .filter((rule) => rule.targetTaskId && rule.targetTaskId.length > 0)
        .map((rule) => ({
          id: rule.id,
          relation: rule.relation,
          targetTaskId: rule.targetTaskId,
          when: null,
        })),
    );
    onClose();
  };

  const addOrderRule = () => {
    const firstTarget = targetOptions[0]?.value;
    if (!firstTarget) return;
    setDraft((prev) => ({
      ...prev,
      order: [...prev.order, freshOrderRule(firstTarget)],
    }));
  };

  const updateOrderRule = (id: string, patch: Partial<DraftTask["order"][number]>) => {
    setDraft((prev) => ({
      ...prev,
      order: prev.order.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    }));
  };

  const removeOrderRule = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      order: prev.order.filter((rule) => rule.id !== id),
    }));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={taskId
        ? t(`${i18nPrefix}.subtaskEditTitle`) || "Edit sub-task"
        : t(`${i18nPrefix}.subtaskAddTitle`) || "Add sub-task"}
      size="lg"
      centered
      data-testid={`${testIdSuffix}-root`}
    >
      <Stack gap="md">
        <TextInput
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.currentTarget.value }))}
          label={t(`${i18nPrefix}.subtaskTitleLabel`) || "Title"}
          placeholder={t(`${i18nPrefix}.taskTitlePlaceholder`) || "What needs to happen?"}
          required
          withAsterisk
          data-testid={`${testIdSuffix}-title`}
        />
        <Textarea
          value={draft.note ?? ""}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              note: e.currentTarget.value.length > 0 ? e.currentTarget.value : null,
            }))
          }
          label={t(`${i18nPrefix}.subtaskNoteLabel`) || "Note"}
          placeholder={t(`${i18nPrefix}.taskDescriptionPlaceholder`) || "Why this task matters"}
          autosize
          minRows={2}
          maxRows={6}
          data-testid={`${testIdSuffix}-note`}
        />

        <div className="flex flex-col gap-1.5">
          <Text size="sm" fw={500}>
            {t(`${i18nPrefix}.taskShowLabel`) || "Show condition"}
          </Text>
          <Switch
            checked={draft.show !== null}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setDraft((prev) => ({
                ...prev,
                show: checked
                  ? { kind: ConditionKind.ALL, children: [], term: null }
                  : null,
              }));
            }}
            label={t(`${i18nPrefix}.taskShowEnabledLabel`) || "Only show when…"}
            data-testid={`${testIdSuffix}-show-toggle`}
          />
          {draft.show !== null && (
            <ConditionEditor
              node={draft.show}
              onChange={(next) => setDraft((prev) => ({ ...prev, show: next }))}
              t={t}
              maxDepth={2}
              slot="completion.root"
              taskOptions={targetOptions}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Text size="sm" fw={500}>
            {t(`${i18nPrefix}.taskCompleteLabel`) || "Complete condition"}
          </Text>
          <ConditionEditor
            node={draft.complete}
            onChange={(next) => setDraft((prev) => ({ ...prev, complete: next }))}
            t={t}
            maxDepth={2}
            slot="completion.root"
            taskOptions={targetOptions}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Text size="sm" fw={500}>
              {t(`${i18nPrefix}.taskOrderLabel`) || "Order rules"}
            </Text>
            <Button
              type="button"
              size="compact-xs"
              variant="subtle"
              leftSection={<Plus className="h-3 w-3" aria-hidden />}
              onClick={addOrderRule}
              disabled={targetOptions.length === 0}
              data-testid={`${testIdSuffix}-order-add`}
            >
              {t(`${i18nPrefix}.taskOrderAdd`) || "Add rule"}
            </Button>
          </div>
          {draft.order.length === 0 ? (
            <Text size="xs" c="dimmed" data-testid={`${testIdSuffix}-order-empty`}>
              {t(`${i18nPrefix}.taskOrderEmpty`) || "No ordering constraints."}
            </Text>
          ) : (
            <Stack gap="xs" data-testid={`${testIdSuffix}-order-list`}>
              {draft.order.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-2"
                  data-testid={`${testIdSuffix}-order-rule-${rule.id}`}
                >
                  <Select
                    value={String(rule.relation)}
                    onChange={(value) => {
                      if (value === null) return;
                      updateOrderRule(rule.id, { relation: Number(value) });
                    }}
                    data={[
                      { value: String(TaskOrderRelation.BEFORE), label: t(`${i18nPrefix}.taskOrderBefore`) || "Before" },
                      { value: String(TaskOrderRelation.AFTER), label: t(`${i18nPrefix}.taskOrderAfter`) || "After" },
                    ]}
                    size="xs"
                    className="w-28"
                    aria-label={t(`${i18nPrefix}.taskOrderRelationAria`) || "Relation"}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-relation`}
                  />
                  <Select
                    value={rule.targetTaskId}
                    onChange={(value) => {
                      if (value === null) return;
                      updateOrderRule(rule.id, { targetTaskId: value });
                    }}
                    data={targetOptions}
                    size="xs"
                    className="flex-1"
                    aria-label={t(`${i18nPrefix}.taskOrderTargetAria`) || "Target task"}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-target`}
                  />
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() => removeOrderRule(rule.id)}
                    aria-label={t(`${i18nPrefix}.removeItem`) || "Remove"}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-remove`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </ActionIcon>
                </div>
              ))}
            </Stack>
          )}
        </div>

        <Checkbox
          checked={draft.done}
          onChange={(e) => setDraft((prev) => ({ ...prev, done: e.currentTarget.checked }))}
          label={t(`${i18nPrefix}.subtaskDoneLabel`) || "Mark as done"}
          data-testid={`${testIdSuffix}-done`}
        />

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="default"
            onClick={onClose}
            data-testid={`${testIdSuffix}-cancel`}
          >
            {t(`${i18nPrefix}.cancel`) || "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid={`${testIdSuffix}-submit`}
          >
            {taskId
              ? t(`${i18nPrefix}.save`) || "Save"
              : t(`${i18nPrefix}.add`) || "Add"}
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
