import {
  type SubPanelKey,
  SubPanelShell,
} from "@/features/create-tile/ui/SubPanelShell";
import type { TaskDefinition } from "@/shared/model/v1/completion";
import { TaskOrderRelation } from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { Plan } from "@/shared/model/v1/tile-types";
import { hasTaskOrderCycle } from "@/shared/stores/quick-create-store";
import { Textarea } from "@/shared/ui/Input";
import { FormPanel, FormRow } from "@/shared/ui/form";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import { ActionIcon, Button, SegmentedControl, Select } from "@mantine/core";
import { Check, Link2, ListChecks, Plus, Trash2, X } from "lucide-react";

export interface TaskDetailSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  plan: Plan;
  setTaskField: (taskId: string, path: string, value: unknown) => void;
  removeTask: (taskId: string) => void;
}

export function TaskDetailSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  editingTaskId,
  setEditingTaskId,
  plan,
  setTaskField,
  removeTask,
}: TaskDetailSubPanelProps) {
  return (
    <SubPanelShell
      panelKey="task-details"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="task-heading"
      title={t("quickCreate.taskDetailTitle")}
      description={t("quickCreate.taskDetailSub")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <FormPanel>
        {(() => {
          const task = plan.completion.tasks.find(
            (tk) => tk.id === editingTaskId,
          );
          if (!task || !editingTaskId) {
            return (
              <p className="text-xs text-foreground-muted">
                {t("quickCreate.taskNoTasksHint")}
              </p>
            );
          }
          const otherTasks = plan.completion.tasks.filter(
            (tk) => tk.id !== task.id,
          );
          const orderHasCycle = hasTaskOrderCycle(plan.completion.tasks);
          return (
            <div
              className="flex flex-col gap-4"
              data-testid="task-detail-panel"
            >
              <FormRow
                icon={<ListChecks className="size-4" aria-hidden />}
                className="items-start"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">
                    {t("quickCreate.taskNoteLabel")}
                  </span>
                  <Textarea
                    value={task.content.note ?? ""}
                    onChange={(e) =>
                      setTaskField(
                        task.id,
                        "content.note",
                        e.target.value || null,
                      )
                    }
                    placeholder={t("quickCreate.taskNotePlaceholder")}
                    aria-label={t("quickCreate.taskNoteLabel")}
                    rows={4}
                    className="w-full resize-none border-0 bg-surface-1 p-2 text-sm focus-visible:outline-none"
                  />
                </div>
              </FormRow>

              <FormRow
                icon={<Link2 className="size-4" aria-hidden />}
                className="items-start"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">
                    {t("quickCreate.taskOrderSection")}
                  </span>
                  {task.order.length === 0 ? (
                    <p className="rounded-md bg-surface-1 px-2.5 py-3 text-center text-caption text-foreground-muted">
                      {t("quickCreate.taskOrderEmpty")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {task.order.map((rule, i) => {
                        const targetTask = plan.completion.tasks.find(
                          (tk) => tk.id === rule.targetTaskId,
                        );
                        const targetTitle =
                          targetTask?.content.title ||
                          t("quickCreate.taskUntitled");
                        return (
                          <div
                            key={rule.id}
                            data-testid={`task-order-row-${i}`}
                            className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface-0 p-2"
                          >
                            <div className="flex items-center gap-2">
                              <Select
                                aria-label={t("quickCreate.taskOrderTarget")}
                                value={rule.targetTaskId}
                                onChange={(value) => {
                                  if (!value) return;
                                  const next = task.order.slice();
                                  next[i] = { ...rule, targetTaskId: value };
                                  setTaskField(task.id, "order", next);
                                }}
                                data={otherTasks.map((tk) => ({
                                  value: tk.id,
                                  label:
                                    tk.content.title ||
                                    t("quickCreate.taskUntitled"),
                                }))}
                                placeholder={t(
                                  "quickCreate.taskOrderTargetPlaceholder",
                                )}
                                size="xs"
                                variant="filled"
                                comboboxProps={{ withinPortal: true }}
                                className="flex-1"
                                styles={{
                                  input: {
                                    backgroundColor: "var(--surface-2)",
                                  },
                                }}
                              />
                              <ActionIcon
                                type="button"
                                variant="subtle"
                                size="xs"
                                aria-label={t("quickCreate.removeItem")}
                                onClick={() => {
                                  const next = task.order.slice();
                                  next.splice(i, 1);
                                  setTaskField(task.id, "order", next);
                                }}
                                className="text-foreground-muted hover:text-danger"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </ActionIcon>
                            </div>
                            <SegmentedControl
                              fullWidth
                              size="xs"
                              radius="md"
                              withItemsBorders={false}
                              value={String(rule.relation)}
                              onChange={(value) => {
                                const next = task.order.slice();
                                next[i] = {
                                  ...rule,
                                  relation: Number(value) as
                                    | typeof TaskOrderRelation.BEFORE
                                    | typeof TaskOrderRelation.AFTER,
                                };
                                setTaskField(task.id, "order", next);
                              }}
                              data={[
                                {
                                  value: String(TaskOrderRelation.BEFORE),
                                  label: t(
                                    "quickCreate.referenceRelationBefore",
                                  ),
                                },
                                {
                                  value: String(TaskOrderRelation.AFTER),
                                  label: t(
                                    "quickCreate.referenceRelationAfter",
                                  ),
                                },
                              ]}
                              aria-label={t("quickCreate.taskOrderSection")}
                              styles={SEGMENT_STYLES}
                            />
                            <p className="text-caption text-foreground-muted">
                              {rule.relation === TaskOrderRelation.BEFORE
                                ? `${task.content.title || t("quickCreate.taskUntitled")} → ${targetTitle}`
                                : `${targetTitle} → ${task.content.title || t("quickCreate.taskUntitled")}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    variant="default"
                    leftSection={<Plus size={12} aria-hidden="true" />}
                    onClick={() => {
                      const fallbackTarget = otherTasks[0]?.id ?? null;
                      if (!fallbackTarget) return;
                      const newRule = {
                        id: uuidv7(),
                        targetTaskId: fallbackTarget,
                        relation: TaskOrderRelation.BEFORE,
                        when: null,
                      };
                      setTaskField(task.id, "order", [...task.order, newRule]);
                    }}
                    data-testid="task-order-add"
                    disabled={otherTasks.length === 0}
                  >
                    {t("quickCreate.taskOrderAdd")}
                  </Button>
                  {orderHasCycle ? (
                    <p
                      role="alert"
                      data-testid="task-order-cycle"
                      className="rounded-md bg-danger/10 px-2 py-1 text-caption font-semibold text-danger"
                    >
                      {t("quickCreate.taskOrderCycle")}
                    </p>
                  ) : null}
                </div>
              </FormRow>

              <div className="flex items-center gap-2 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="subtle"
                  leftSection={<Trash2 size={12} aria-hidden="true" />}
                  onClick={() => {
                    removeTask(task.id);
                    setEditingTaskId(null);
                    setActivePanel("base");
                  }}
                  data-testid="task-remove"
                  className="text-danger hover:bg-danger/10"
                >
                  {t("quickCreate.taskRemoveLabel")}
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  leftSection={<X size={12} aria-hidden="true" />}
                  onClick={() => {
                    setEditingTaskId(null);
                    setActivePanel("base");
                  }}
                >
                  {t("quickCreate.completionCancelLabel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="filled"
                  leftSection={<Check size={12} aria-hidden="true" />}
                  onClick={() => {
                    setEditingTaskId(null);
                    setActivePanel("base");
                  }}
                  data-testid="task-apply"
                >
                  {t("quickCreate.referenceApplyLabel")}
                </Button>
              </div>
            </div>
          );
        })()}
      </FormPanel>
    </SubPanelShell>
  );
}
