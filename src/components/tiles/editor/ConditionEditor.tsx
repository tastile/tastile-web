"use client";

import { Button, NumberInput, Select, TextInput } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { GitBranch, ListChecks, Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { RowSegmented } from "@/components/ui/form";
import type { ConditionNode, Term } from "@/lib/domain/v1/condition";
import { ConditionKind, HolidayKind } from "@/lib/domain/v1/constants";

// ============================================================
// Internal segmented pickers
// ============================================================

function ConditionKindSegmented({
  value,
  onChange,
  t,
}: {
  value: number | import("@/lib/domain/v1/constants").ConditionKindValue;
  onChange: (v: number) => void;
  t: (k: string) => string;
}) {
  const options = [
    { value: String(ConditionKind.ALL), label: t("quickCreate.conditionAll") },
    { value: String(ConditionKind.ANY), label: t("quickCreate.conditionAny") },
    { value: String(ConditionKind.NOT), label: t("quickCreate.conditionNot") },
    { value: String(ConditionKind.TERM), label: t("quickCreate.conditionTerm") },
  ];
  return (
    <RowSegmented
      icon={GitBranch}
      options={options}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function TermKindSegmented({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  const options = [
    { value: "calendar", label: t("quickCreate.termCalendar") },
    { value: "moment", label: t("quickCreate.termMoment") },
    { value: "relation", label: t("quickCreate.termRelation") },
    { value: "gap", label: t("quickCreate.termGap") },
    { value: "requirement", label: t("quickCreate.termRequirement") },
    { value: "task", label: t("quickCreate.termTask") },
    { value: "fact", label: t("quickCreate.termFact") },
    { value: "metric", label: t("quickCreate.termMetric") },
    { value: "life", label: t("quickCreate.termLife") },
  ];
  return (
    <RowSegmented icon={ListChecks} options={options} value={value} onChange={onChange} compact />
  );
}

// ============================================================
// Default term factory
// ============================================================

export function defaultTerm(kind: string): Term {
  switch (kind) {
    case "calendar":
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
    case "moment":
      return { kind: "moment", value: { referenceId: null, point: null, offsetMs: 0 } };
    case "relation":
      return { kind: "relation", value: { referenceId: "", relation: 0, windowKind: 0 } };
    case "gap":
      return {
        kind: "gap",
        value: {
          scope: 0,
          leftAnchor: { referenceId: null, point: null },
          rightAnchor: { referenceId: null, point: null },
          size: { minMs: null, maxMs: null },
        },
      };
    case "requirement":
      return { kind: "requirement", value: { requirementId: "", state: 0 } };
    case "task":
      return { kind: "task", value: { taskId: "", state: 0 } };
    case "fact":
      return { kind: "fact", value: { factId: "", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "", op: 0, value: null } };
    case "feedback":
      return { kind: "feedback", value: { feedbackTxnId: "", op: 0, value: null } };
    case "life":
      return { kind: "life", value: { target: "", state: 0 } };
    default:
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
  }
}

// ============================================================
// Pure updater helpers
// ============================================================

function updateCalendar(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").CalendarTerm,
  value: import("@/lib/domain/v1/condition").CalendarTerm[keyof import("@/lib/domain/v1/condition").CalendarTerm],
) {
  if (term.kind !== "calendar") return term;
  return { kind: "calendar", value: { ...term.value, [key]: value } } as Term;
}
function updateMoment(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").MomentTerm,
  value: import("@/lib/domain/v1/condition").MomentTerm[keyof import("@/lib/domain/v1/condition").MomentTerm],
) {
  if (term.kind !== "moment") return term;
  return { kind: "moment", value: { ...term.value, [key]: value } } as Term;
}
function updateRelation(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").RelationTerm,
  value: import("@/lib/domain/v1/condition").RelationTerm[keyof import("@/lib/domain/v1/condition").RelationTerm],
) {
  if (term.kind !== "relation") return term;
  return { kind: "relation", value: { ...term.value, [key]: value } } as Term;
}
function updateTask(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").TaskTerm,
  value: import("@/lib/domain/v1/condition").TaskTerm[keyof import("@/lib/domain/v1/condition").TaskTerm],
) {
  if (term.kind !== "task") return term;
  return { kind: "task", value: { ...term.value, [key]: value } } as Term;
}
function updateRequirement(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").RequirementTerm,
  value: import("@/lib/domain/v1/condition").RequirementTerm[keyof import("@/lib/domain/v1/condition").RequirementTerm],
) {
  if (term.kind !== "requirement") return term;
  return { kind: "requirement", value: { ...term.value, [key]: value } } as Term;
}
function updateLife(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").LifeTerm,
  value: import("@/lib/domain/v1/condition").LifeTerm[keyof import("@/lib/domain/v1/condition").LifeTerm],
) {
  if (term.kind !== "life") return term;
  return { kind: "life", value: { ...term.value, [key]: value } } as Term;
}
function updateValue(term: Term, key: string, value: unknown): Term {
  if (term.kind !== "fact" && term.kind !== "metric" && term.kind !== "feedback") return term;
  return { ...term, value: { ...term.value, [key]: value } } as Term;
}

// ============================================================
// TermFields — renders fields for a Term based on its kind
// ============================================================

function TermFields({
  term,
  onChange,
  t,
  tileOptions,
}: {
  term: Term;
  onChange: (next: Term) => void;
  t: (k: string) => string;
  tileOptions?: { value: string; label: string }[];
}) {
  const fieldIdBase = useId();
  switch (term.kind) {
    case "calendar":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-weekdayMask`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarWeekdayMask")}
            </span>
            <NumberInput
              id={`${fieldIdBase}-weekdayMask`}
              value={term.value.weekdayMask}
              onChange={(value) =>
                onChange(updateCalendar(term, "weekdayMask", Number(value) || 0))
              }
              size="xs"
              className="w-full"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-offsetMin`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarOffsetMin")}
            </span>
            <NumberInput
              id={`${fieldIdBase}-offsetMin`}
              value={term.value.offsetMin}
              onChange={(value) => onChange(updateCalendar(term, "offsetMin", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-timeStart`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarTimeStart")}
            </span>
            <TimeInput
              id={`${fieldIdBase}-timeStart`}
              value={term.value.timeStart ?? ""}
              onChange={(e) =>
                onChange(
                  updateCalendar(
                    term,
                    "timeStart",
                    e.currentTarget.value === "" ? null : e.currentTarget.value,
                  ),
                )
              }
              size="xs"
              variant="filled"
              styles={{ input: { backgroundColor: "var(--surface-2)" } }}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-timeEnd`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.calendarTimeEnd")}</span>
            <TimeInput
              id={`${fieldIdBase}-timeEnd`}
              value={term.value.timeEnd ?? ""}
              onChange={(e) =>
                onChange(
                  updateCalendar(
                    term,
                    "timeEnd",
                    e.currentTarget.value === "" ? null : e.currentTarget.value,
                  ),
                )
              }
              size="xs"
              variant="filled"
              styles={{ input: { backgroundColor: "var(--surface-2)" } }}
            />
          </label>
        </div>
      );
    case "moment":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-referenceId`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.momentReferenceId")}
            </span>
            <Select
              id={`${fieldIdBase}-referenceId`}
              value={term.value.referenceId ?? ""}
              onChange={(v) => onChange(updateMoment(term, "referenceId", v === "" ? null : v))}
              data={tileOptions ?? []}
              searchable
              clearable
              placeholder={t("quickCreate.selectTile")}
              size="xs"
              comboboxProps={{ withinPortal: false }}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-offsetMs`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.momentOffsetMs")}</span>
            <NumberInput
              id={`${fieldIdBase}-offsetMs`}
              value={term.value.offsetMs}
              onChange={(value) => onChange(updateMoment(term, "offsetMs", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
        </div>
      );
    case "relation":
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-referenceId`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.relationReferenceId")}
            </span>
            <Select
              id={`${fieldIdBase}-referenceId`}
              value={term.value.referenceId}
              onChange={(v) => onChange(updateRelation(term, "referenceId", v ?? ""))}
              data={tileOptions ?? []}
              searchable
              clearable
              placeholder={t("quickCreate.selectTile")}
              size="xs"
              comboboxProps={{ withinPortal: false }}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-relation`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.relationKind")}</span>
            <NumberInput
              id={`${fieldIdBase}-relation`}
              value={term.value.relation}
              onChange={(value) => onChange(updateRelation(term, "relation", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-windowKind`} className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.relationWindowKind")}
            </span>
            <NumberInput
              id={`${fieldIdBase}-windowKind`}
              value={term.value.windowKind}
              onChange={(value) => onChange(updateRelation(term, "windowKind", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
        </div>
      );
    case "task":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-taskId`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.taskId")}</span>
            <TextInput
              id={`${fieldIdBase}-taskId`}
              value={term.value.taskId}
              onChange={(e) => onChange(updateTask(term, "taskId", e.target.value))}
              size="xs"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.taskState")}</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateTask(term, "state", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
        </div>
      );
    case "requirement":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-requirementId`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.requirementId")}</span>
            <TextInput
              id={`${fieldIdBase}-requirementId`}
              value={term.value.requirementId}
              onChange={(e) => onChange(updateRequirement(term, "requirementId", e.target.value))}
              size="xs"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.requirementState")}</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateRequirement(term, "state", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
        </div>
      );
    case "metric":
    case "fact":
    case "feedback": {
      const v = term.value as unknown as { op: number; value: unknown; [k: string]: unknown };
      const idKey =
        term.kind === "fact" ? "factId" : term.kind === "metric" ? "metricId" : "feedbackTxnId";
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-id`} className="space-y-1">
            <span className="block text-foreground-muted">ID</span>
            <TextInput
              id={`${fieldIdBase}-id`}
              value={String(v[idKey] ?? "")}
              onChange={(e) => onChange(updateValue(term, idKey, e.target.value))}
              size="xs"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-op`} className="space-y-1">
            <span className="block text-foreground-muted">op</span>
            <NumberInput
              id={`${fieldIdBase}-op`}
              value={v.op}
              onChange={(value) => onChange(updateValue(term, "op", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-value`} className="space-y-1">
            <span className="block text-foreground-muted">value</span>
            <TextInput
              id={`${fieldIdBase}-value`}
              value={v.value === null || v.value === undefined ? "" : String(v.value)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange(updateValue(term, "value", null));
                  return;
                }
                const num = Number(raw);
                onChange(
                  updateValue(term, "value", Number.isFinite(num) && raw.trim() !== "" ? num : raw),
                );
              }}
              size="xs"
            />
          </label>
        </div>
      );
    }
    case "life":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-target`} className="space-y-1">
            <span className="block text-foreground-muted">target</span>
            <TextInput
              id={`${fieldIdBase}-target`}
              value={term.value.target}
              onChange={(e) => onChange(updateLife(term, "target", e.target.value))}
              size="xs"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">state</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateLife(term, "state", Number(value) || 0))}
              size="xs"
              className="w-full"
            />
          </label>
        </div>
      );
    case "gap":
      return <p className="text-xs text-foreground-muted">{t("quickCreate.gapPlaceholder")}</p>;
    default:
      return null;
  }
}

// ============================================================
// ConditionEditor — renders a ConditionNode recursively
// ============================================================

export function ConditionEditor({
  node,
  onChange,
  t,
  tileOptions,
}: {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  t: (k: string) => string;
  tileOptions?: { value: string; label: string }[];
}) {
  const isTerm = node.kind === ConditionKind.TERM;
  return (
    <div className="flex flex-col gap-1">
      <ConditionKindSegmented
        value={node.kind as number}
        onChange={(kind) => {
          if (kind === ConditionKind.TERM) {
            const currentTerm = node.term ?? defaultTerm("calendar");
            onChange({
              kind: kind as import("@/lib/domain/v1/constants").ConditionKindValue,
              children: [],
              term: currentTerm,
            });
          } else {
            onChange({
              kind: kind as import("@/lib/domain/v1/constants").ConditionKindValue,
              children: node.children,
              term: null,
            });
          }
        }}
        t={t}
      />
      {isTerm ? (
        <>
          <TermKindSegmented
            value={node.term?.kind ?? "calendar"}
            onChange={(k) =>
              onChange({ kind: ConditionKind.TERM, children: [], term: defaultTerm(k) })
            }
            t={t}
          />
          {node.term ? (
            <TermFields
              term={node.term}
              onChange={(next) => onChange({ kind: ConditionKind.TERM, children: [], term: next })}
              t={t}
              tileOptions={tileOptions}
            />
          ) : null}
        </>
      ) : (
        <>
          {node.children.map((child, i) => (
            <div key={i} className="flex flex-col gap-1">
              <ConditionEditor
                node={child}
                onChange={(next) => {
                  const children = node.children.slice();
                  children[i] = next;
                  onChange({ ...node, children });
                }}
                t={t}
                tileOptions={tileOptions}
              />
              <Button
                type="button"
                size="xs"
                variant="subtle"
                leftSection={<Trash2 size={14} aria-hidden="true" />}
                onClick={() => {
                  const children = node.children.slice();
                  children.splice(i, 1);
                  onChange({ ...node, children });
                }}
                aria-label={t("quickCreate.conditionRemoveChild")}
                className="self-start text-foreground-muted hover:text-danger"
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="default"
            leftSection={<Plus size={12} aria-hidden="true" />}
            onClick={() =>
              onChange({
                ...node,
                children: [
                  ...node.children,
                  { kind: ConditionKind.TERM, children: [], term: defaultTerm("calendar") },
                ],
              })
            }
          >
            {t("quickCreate.conditionAddChild")}
          </Button>
        </>
      )}
    </div>
  );
}
