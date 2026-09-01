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
} from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/shared/i18n/use-translation";
import type { ConditionNode } from "@/shared/model/v1/condition";
import { ConditionKind } from "@/shared/model/v1/constants";
import { TaskOrderRelation } from "@/shared/model/v1/constants";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

import { ConditionEditor } from "./ConditionEditor";
import { QuickCreateHeader } from "./QuickCreateHeader";

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

// Sentinel id baked into the freshly-created draft so the modal can
// reach a non-null `term.value.taskId` without knowing the new task's
// id yet. `handleSubmit` swaps the sentinel for the real id returned
// by `addTask` before the condition is written back to the store.
const DRAFT_TASK_ID_SENTINEL = "__new__";

function defaultComplete(id: string): ConditionNode {
  return {
    kind: ConditionKind.TERM,
    children: [],
    term: { kind: "task", value: { taskId: id, state: 2 } },
  };
}

/**
 * Walk a condition tree and rewrite any `term.kind === "task"` whose
 * `taskId` matches the placeholder sentinel into the real task id.
 * Used by `handleSubmit` so a brand-new task's `complete` / `show`
 * condition points back at itself (instead of `__new__`).
 */
function substituteTaskIdInCondition(
  node: ConditionNode | null,
  sentinel: string,
  realId: string,
): ConditionNode | null {
  if (!node) return node;
  const rewrittenTerm =
    node.term?.kind === "task" && node.term.value.taskId === sentinel
      ? {
          kind: "task" as const,
          value: { ...node.term.value, taskId: realId },
        }
      : node.term;
  return {
    ...node,
    term: rewrittenTerm,
    // ConditionNode.children is a non-nullable array per the v1
    // ConditionNode shape, so we discard any null children returned
    // by the recursive walk. In practice the tree is built via
    // defaultComplete() which never produces null children, but the
    // type narrowing keeps tsc happy.
    children: node.children
      .map((child) => substituteTaskIdInCondition(child, sentinel, realId))
      .filter((child): child is ConditionNode => child !== null),
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
    () => (taskId ? (tasks.find((task) => task.id === taskId) ?? null) : null),
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
    return emptyDraft(defaultComplete(DRAFT_TASK_ID_SENTINEL));
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
      setDraft(emptyDraft(defaultComplete(DRAFT_TASK_ID_SENTINEL)));
    }
  }, [opened, existing]);

  const targetOptions = useMemo(() => {
    const options = tasks
      .filter((task) => task.id !== taskId)
      .map((task) => ({
        value: task.id,
        label: task.content.title || t(`${i18nPrefix}.taskUntitled`),
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
    // New tasks carry the placeholder sentinel in their default
    // `complete` / `show` condition. After `addTask` mints the real
    // id, rewrite those trees so the stored task points back at itself
    // instead of `__new__`.
    const nextComplete = substituteTaskIdInCondition(
      draft.complete,
      DRAFT_TASK_ID_SENTINEL,
      targetId,
    );
    const nextShow = substituteTaskIdInCondition(
      draft.show,
      DRAFT_TASK_ID_SENTINEL,
      targetId,
    );
    setTaskField(targetId, "content.title", trimmedTitle);
    setTaskField(
      targetId,
      "content.note",
      draft.note && draft.note.length > 0 ? draft.note : null,
    );
    setTaskField(targetId, "done", draft.done);
    setTaskField(targetId, "show", nextShow);
    setTaskField(targetId, "complete", nextComplete);
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

  const updateOrderRule = (
    id: string,
    patch: Partial<DraftTask["order"][number]>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      order: prev.order.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
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
      centered
      withCloseButton={false}
      size="md"
      data-testid={`${testIdSuffix}-root`}
    >
      <QuickCreateHeader
        value={draft.title}
        onChange={(next) => setDraft((prev) => ({ ...prev, title: next }))}
        onClose={onClose}
        placeholder={t(`${i18nPrefix}.taskTitlePlaceholder`)}
        closeTestId={`${testIdSuffix}-cancel`}
        closeAriaLabel={t(`${i18nPrefix}.cancel`)}
        titleTestId={`${testIdSuffix}-title`}
        required
        autoFocus
        padded={false}
        submitButton={
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid={`${testIdSuffix}-submit`}
          >
            {taskId ? t(`${i18nPrefix}.save`) : t(`${i18nPrefix}.add`)}
          </Button>
        }
      />
      <Stack gap="md" className="px-4 pb-4 pt-2">
        <TextInput
          value={draft.note ?? ""}
          onChange={(e) => {
            // Capture the value up-front: React 19 nulls `currentTarget` on
            // the pooled synthetic event before the setState reducer runs,
            // so we cannot read it inside the updater.
            const value = e.currentTarget.value;
            setDraft((prev) => ({
              ...prev,
              note: value.length > 0 ? value : null,
            }));
          }}
          placeholder={t(`${i18nPrefix}.taskDescriptionPlaceholder`)}
          variant="unstyled"
          size="sm"
          data-testid={`${testIdSuffix}-note`}
          aria-label={t(`${i18nPrefix}.taskDescriptionPlaceholder`)}
          classNames={{
            input:
              "qc-underline-input--muted bg-transparent text-sm leading-relaxed text-foreground placeholder:text-[var(--foreground-muted)] px-0 h-auto",
          }}
        />

        <div className="flex flex-col gap-1.5">
          <Text size="sm" fw={500}>
            {t(`${i18nPrefix}.taskShowLabel`)}
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
            label={t(`${i18nPrefix}.taskShowEnabledLabel`)}
            size="sm"
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
            {t(`${i18nPrefix}.taskCompleteLabel`)}
          </Text>
          <ConditionEditor
            node={draft.complete}
            onChange={(next) =>
              setDraft((prev) => ({ ...prev, complete: next }))
            }
            t={t}
            maxDepth={2}
            slot="completion.root"
            taskOptions={targetOptions}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Text size="sm" fw={500}>
              {t(`${i18nPrefix}.taskOrderLabel`)}
            </Text>
            <Button
              type="button"
              size="sm"
              variant="subtle"
              leftSection={<Plus className="size-3" aria-hidden />}
              onClick={addOrderRule}
              disabled={targetOptions.length === 0}
              data-testid={`${testIdSuffix}-order-add`}
            >
              {t(`${i18nPrefix}.taskOrderAdd`)}
            </Button>
          </div>
          {draft.order.length === 0 ? (
            <Text
              size="sm"
              c="dimmed"
              data-testid={`${testIdSuffix}-order-empty`}
            >
              {t(`${i18nPrefix}.taskOrderEmpty`)}
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
                      {
                        value: String(TaskOrderRelation.BEFORE),
                        label: t(`${i18nPrefix}.taskOrderBefore`),
                      },
                      {
                        value: String(TaskOrderRelation.AFTER),
                        label: t(`${i18nPrefix}.taskOrderAfter`),
                      },
                    ]}
                    size="sm"
                    className="w-28"
                    aria-label={t(`${i18nPrefix}.taskOrderRelationAria`)}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-relation`}
                  />
                  <Select
                    value={rule.targetTaskId}
                    onChange={(value) => {
                      if (value === null) return;
                      updateOrderRule(rule.id, { targetTaskId: value });
                    }}
                    data={targetOptions}
                    size="sm"
                    className="flex-1"
                    aria-label={t(`${i18nPrefix}.taskOrderTargetAria`)}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-target`}
                  />
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeOrderRule(rule.id)}
                    aria-label={t(`${i18nPrefix}.removeItem`)}
                    data-testid={`${testIdSuffix}-order-rule-${rule.id}-remove`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </ActionIcon>
                </div>
              ))}
            </Stack>
          )}
        </div>

        <Checkbox
          checked={draft.done}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, done: e.currentTarget.checked }))
          }
          label={t(`${i18nPrefix}.subtaskDoneLabel`)}
          size="sm"
          data-testid={`${testIdSuffix}-done`}
        />
      </Stack>
    </Modal>
  );
}
