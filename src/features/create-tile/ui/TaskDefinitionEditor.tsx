"use client";

import { Button, TextInput, Textarea } from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { ConditionEditor } from "./ConditionEditor";

export interface TaskDefinitionEditorProps {
  t: (key: string) => string;
}

export function TaskDefinitionEditor({ t }: TaskDefinitionEditorProps) {
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);

  return (
    <div className="flex flex-col gap-3" data-testid="task-definition-editor">
      <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
        {t("quickCreate.tasksSectionTitle")}
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-2 rounded-md border border-border/40 bg-surface-1 p-2"
          data-testid="task-row"
        >
          <div className="flex items-center gap-2">
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
