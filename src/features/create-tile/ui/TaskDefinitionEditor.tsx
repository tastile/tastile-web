"use client";

import { Button, Switch, TextInput, Textarea } from "@mantine/core";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import type { ConditionNode } from "@/tile/model/v1/condition";
import { ConditionKind } from "@/tile/model/v1/constants";
import { ConditionEditor } from "./ConditionEditor";

function defaultShowCondition(): ConditionNode {
  return {
    kind: ConditionKind.ALL,
    children: [],
    term: null,
  };
}

export interface TaskDefinitionEditorProps {
  t: (key: string) => string;
}

export function TaskDefinitionEditor({ t }: TaskDefinitionEditorProps) {
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const reorderTasks = useQuickCreateStore((s) => s.reorderTasks);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);

  return (
    <div className="flex flex-col gap-3" data-testid="task-definition-editor">
      <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
        {t("quickCreate.tasksSectionTitle")}
      </div>
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className="flex flex-col gap-2 rounded-md border border-border/40 bg-surface-1 p-2"
          data-testid="task-row"
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <Button
                type="button"
                size="compact-xs"
                variant="subtle"
                onClick={() => reorderTasks(index, index - 1)}
                disabled={index === 0}
                aria-label={t("quickCreate.moveUp")}
                data-testid="task-move-up"
              >
                <ChevronUp size={12} />
              </Button>
              <Button
                type="button"
                size="compact-xs"
                variant="subtle"
                onClick={() => reorderTasks(index, index + 1)}
                disabled={index === tasks.length - 1}
                aria-label={t("quickCreate.moveDown")}
                data-testid="task-move-down"
              >
                <ChevronDown size={12} />
              </Button>
            </div>
            <TextInput
              value={task.content.title}
              onChange={(e) => setTaskField(task.id, "content.title", e.target.value)}
              placeholder={t("quickCreate.taskTitlePlaceholder")}
              aria-label={t("quickCreate.taskTitlePlaceholder")}
              size="xs"
              className="flex-1"
              data-testid="task-title-input"
            />
            <Button
              type="button"
              size="xs"
              variant="subtle"
              leftSection={<Trash2 size={12} aria-hidden="true" />}
              onClick={() => removeTask(task.id)}
              aria-label={t("quickCreate.removeItem")}
              className="text-foreground-muted hover:text-danger"
            />
          </div>
          <Textarea
            value={task.content.note ?? ""}
            onChange={(e) => setTaskField(task.id, "content.note", e.target.value || null)}
            placeholder={t("quickCreate.taskDescriptionPlaceholder")}
            aria-label={t("quickCreate.taskDescriptionPlaceholder")}
            rows={2}
            size="xs"
            className="resize-none"
          />
          <div className="flex items-center gap-2">
            <Switch
              size="xs"
              checked={task.show !== null}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setTaskField(
                  task.id,
                  "show",
                  checked ? defaultShowCondition() : null,
                );
              }}
              label={t("quickCreate.taskShowLabel")}
              aria-label={t("quickCreate.taskShowLabel")}
              data-testid="task-show-toggle"
            />
          </div>
          {task.show !== null && (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                {t("quickCreate.taskShowLabel")}
              </div>
              <ConditionEditor
                node={task.show}
                onChange={(next) => setTaskField(task.id, "show", next)}
                t={t}
                maxDepth={2}
              />
            </div>
          )}
          <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
            {t("quickCreate.taskCompleteLabel")}
          </div>
          <ConditionEditor
            node={task.complete}
            onChange={(next) => setTaskField(task.id, "complete", next)}
            t={t}
            maxDepth={2}
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="default"
        leftSection={<Plus size={12} aria-hidden="true" />}
        onClick={() => addTask()}
        data-testid="add-task-button"
      >
        {t("quickCreate.taskAdd")}
      </Button>
    </div>
  );
}
