"use client";

import { Button, NumberInput, Select, TextInput } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { ChevronDown, ChevronUp, GitBranch, Plus, Search, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import type {
  AnchorSelector,
  CalendarTerm,
  ConditionNode,
  DurationRange,
  GapTerm,
  LifeTerm,
  MomentTerm,
  RelationTerm,
  RequirementTerm,
  TaskTerm,
  Term,
} from "@/shared/model/v1/condition";
import { ConditionKind } from "@/shared/model/v1/constants";
import { RowSegmented } from "@/shared/ui/form";

import { TileReferencePicker } from "./TileReferencePicker";
import { defaultTerm } from "./default-term";

// ============================================================
// Internal segmented pickers
// ============================================================

function ConditionKindSegmented({
  value,
  onChange,
  t,
}: {
  value: number | import("@/shared/model/v1/constants").ConditionKindValue;
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
    { value: "feedback", label: t("quickCreate.termFeedback") },
    { value: "life", label: t("quickCreate.termLife") },
  ];
  return (
    <Select
      data={options}
      value={value}
      onChange={(v) => {
        if (v !== null) onChange(v);
      }}
      size="sm"
      aria-label={t("quickCreate.termKindAria")}
    />
  );
}

// ============================================================
// Pure updater helpers
// biome-ignore format: inline import() types break when split across lines
// ============================================================

function updateCalendar(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").CalendarTerm,
  value: import("@/shared/model/v1/condition").CalendarTerm[keyof import("@/shared/model/v1/condition").CalendarTerm],
) {
  if (term.kind !== "calendar") return term;
  return { kind: "calendar", value: { ...term.value, [key]: value } } as Term;
}
function updateMoment(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").MomentTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for condition terms
  value: any,
) {
  if (term.kind !== "moment") return term;
  return { kind: "moment", value: { ...term.value, [key]: value } } as Term;
}
function updateRelation(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").RelationTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for condition terms
  value: any,
) {
  if (term.kind !== "relation") return term;
  return { kind: "relation", value: { ...term.value, [key]: value } } as Term;
}
function updateTask(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").TaskTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for condition terms
  value: any,
) {
  if (term.kind !== "task") return term;
  return { kind: "task", value: { ...term.value, [key]: value } } as Term;
}
function updateRequirement(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").RequirementTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for condition terms
  value: any,
) {
  if (term.kind !== "requirement") return term;
  return { kind: "requirement", value: { ...term.value, [key]: value } } as Term;
}
function updateLife(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").LifeTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for condition terms
  value: any,
) {
  if (term.kind !== "life") return term;
  return { kind: "life", value: { ...term.value, [key]: value } } as Term;
}
function updateValue(term: Term, key: string, value: unknown): Term {
  if (term.kind !== "fact" && term.kind !== "metric" && term.kind !== "feedback") return term;
  return { ...term, value: { ...term.value, [key]: value } } as Term;
}
function updateGap(
  term: Term,
  key: keyof import("@/shared/model/v1/condition").GapTerm,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for gap term
  value: any,
) {
  if (term.kind !== "gap") return term;
  return { kind: "gap", value: { ...term.value, [key]: value } } as Term;
}
function updateGapAnchor(
  term: Term,
  anchorKey: "leftAnchor" | "rightAnchor",
  field: keyof import("@/shared/model/v1/condition").AnchorSelector,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for gap term
  value: any,
): Term {
  if (term.kind !== "gap") return term;
  return {
    kind: "gap",
    value: {
      ...term.value,
      [anchorKey]: { ...term.value[anchorKey], [field]: value },
    },
  } as Term;
}
function updateGapSize(
  term: Term,
  field: keyof import("@/shared/model/v1/condition").DurationRange,
  // biome-ignore lint/suspicious/noExplicitAny: inline import() type for gap term
  value: any,
): Term {
  if (term.kind !== "gap") return term;
  const currentSize = term.value.size ?? { minMs: null, maxMs: null };
  return {
    kind: "gap",
    value: { ...term.value, size: { ...currentSize, [field]: value } },
  } as Term;
}

// ============================================================
// PickerButton — modal-launched replacement for inline <Select> tile pickers
// ============================================================

interface PickerButtonProps {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  tileKindFilter?: number | number[];
  filterPlanOnly?: boolean;
  ariaLabel?: string;
  testId?: string;
  filledBackground?: boolean;
}

function PickerButton({
  value,
  onChange,
  placeholder,
  tileKindFilter,
  filterPlanOnly,
  ariaLabel,
  testId,
  filledBackground = true,
}: PickerButtonProps) {
  const [opened, setOpened] = useState(false);
  const hasValue = value !== null && value !== "";
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={hasValue ? "light" : "filled"}
        onClick={() => setOpened(true)}
        leftSection={<Search size={12} aria-hidden="true" />}
        aria-label={ariaLabel ?? placeholder}
        data-testid={testId}
        className="justify-start"
        styles={{
          root: {
            backgroundColor: filledBackground ? "var(--surface-2)" : undefined,
            color: hasValue ? "var(--foreground)" : "var(--foreground-muted)",
            width: "100%",
            fontWeight: 400,
          },
        }}
      >
        {hasValue ? value : placeholder}
      </Button>
      <TileReferencePicker
        opened={opened}
        onClose={() => setOpened(false)}
        onSelect={onChange}
        currentValue={value}
        tileKindFilter={tileKindFilter}
        filterPlanOnly={filterPlanOnly}
      />
    </>
  );
}

// ============================================================
// TermFields — renders fields for a Term based on its kind
// ============================================================

function TermFields({
  term,
  onChange,
  t,
}: {
  term: Term;
  onChange: (next: Term) => void;
  t: (k: string) => string;
}) {
  const fieldIdBase = useId();
  const gapIdBase = useId();
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
              size="sm"
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
              size="sm"
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
              size="sm"
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
              size="sm"
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
            <PickerButton
              value={term.value.referenceId}
              onChange={(v) => onChange(updateMoment(term, "referenceId", v))}
              placeholder={t("quickCreate.selectTile")}
              testId={`${fieldIdBase}-referenceId-picker`}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-offsetMs`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.momentOffsetMs")}</span>
            <NumberInput
              id={`${fieldIdBase}-offsetMs`}
              value={term.value.offsetMs}
              onChange={(value) => onChange(updateMoment(term, "offsetMs", Number(value) || 0))}
              size="sm"
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
            <PickerButton
              value={term.value.referenceId}
              onChange={(v) => onChange(updateRelation(term, "referenceId", v ?? ""))}
              placeholder={t("quickCreate.selectTile")}
              testId={`${fieldIdBase}-referenceId-picker`}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-relation`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.relationKind")}</span>
            <NumberInput
              id={`${fieldIdBase}-relation`}
              value={term.value.relation}
              onChange={(value) => onChange(updateRelation(term, "relation", Number(value) || 0))}
              size="sm"
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
              size="sm"
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
            <PickerButton
              value={term.value.taskId}
              onChange={(v) => onChange(updateTask(term, "taskId", v ?? ""))}
              placeholder={t("quickCreate.selectTask")}
              testId={`${fieldIdBase}-taskId-picker`}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.taskState")}</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateTask(term, "state", Number(value) || 0))}
              size="sm"
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
            <PickerButton
              value={term.value.requirementId}
              onChange={(v) => onChange(updateRequirement(term, "requirementId", v ?? ""))}
              placeholder={t("quickCreate.selectRequirement")}
              testId={`${fieldIdBase}-requirementId-picker`}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.requirementState")}</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateRequirement(term, "state", Number(value) || 0))}
              size="sm"
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
            <span className="block text-foreground-muted">{t("quickCreate.termIdLabel")}</span>
            <TextInput
              id={`${fieldIdBase}-id`}
              value={String(v[idKey] ?? "")}
              onChange={(e) => onChange(updateValue(term, idKey, e.target.value))}
              size="sm"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-op`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.termOpLabel")}</span>
            <NumberInput
              id={`${fieldIdBase}-op`}
              value={v.op}
              onChange={(value) => onChange(updateValue(term, "op", Number(value) || 0))}
              size="sm"
              className="w-full"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-value`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.termValueLabel")}</span>
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
              size="sm"
            />
          </label>
        </div>
      );
    }
    case "life":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${fieldIdBase}-target`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.termTargetLabel")}</span>
            <PickerButton
              value={term.value.target}
              onChange={(v) => onChange(updateLife(term, "target", v ?? ""))}
              placeholder={t("quickCreate.selectTile")}
              testId={`${fieldIdBase}-target-picker`}
            />
          </label>
          <label htmlFor={`${fieldIdBase}-state`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.termStateLabel")}</span>
            <NumberInput
              id={`${fieldIdBase}-state`}
              value={term.value.state}
              onChange={(value) => onChange(updateLife(term, "state", Number(value) || 0))}
              size="sm"
              className="w-full"
            />
          </label>
        </div>
      );
    case "gap": {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label htmlFor={`${gapIdBase}-scope`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapScope")}</span>
            <NumberInput
              id={`${gapIdBase}-scope`}
              value={term.value.scope}
              onChange={(value) => onChange(updateGap(term, "scope", Number(value) || 0))}
              size="sm"
              className="w-full"
            />
          </label>
          <label htmlFor={`${gapIdBase}-leftRef`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapLeftAnchor")}</span>
            <PickerButton
              value={term.value.leftAnchor.referenceId}
              onChange={(v) => onChange(updateGapAnchor(term, "leftAnchor", "referenceId", v))}
              placeholder={t("quickCreate.selectTile")}
              testId={`${gapIdBase}-leftRef-picker`}
            />
          </label>
          <label htmlFor={`${gapIdBase}-leftPoint`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapLeftPoint")}</span>
            <NumberInput
              id={`${gapIdBase}-leftPoint`}
              value={term.value.leftAnchor.point ?? 0}
              onChange={(value) =>
                onChange(updateGapAnchor(term, "leftAnchor", "point", Number(value) || 0))
              }
              size="sm"
              className="w-full"
            />
          </label>
          <label htmlFor={`${gapIdBase}-rightRef`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapRightAnchor")}</span>
            <PickerButton
              value={term.value.rightAnchor.referenceId}
              onChange={(v) => onChange(updateGapAnchor(term, "rightAnchor", "referenceId", v))}
              placeholder={t("quickCreate.selectTile")}
              testId={`${gapIdBase}-rightRef-picker`}
            />
          </label>
          <label htmlFor={`${gapIdBase}-rightPoint`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapRightPoint")}</span>
            <NumberInput
              id={`${gapIdBase}-rightPoint`}
              value={term.value.rightAnchor.point ?? 0}
              onChange={(value) =>
                onChange(updateGapAnchor(term, "rightAnchor", "point", Number(value) || 0))
              }
              size="sm"
              className="w-full"
            />
          </label>
          <label htmlFor={`${gapIdBase}-sizeMin`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapSizeMin")}</span>
            <NumberInput
              id={`${gapIdBase}-sizeMin`}
              value={term.value.size?.minMs ?? 0}
              onChange={(value) => onChange(updateGapSize(term, "minMs", Number(value) || 0))}
              size="sm"
              className="w-full"
            />
          </label>
          <label htmlFor={`${gapIdBase}-sizeMax`} className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.gapSizeMax")}</span>
            <NumberInput
              id={`${gapIdBase}-sizeMax`}
              value={term.value.size?.maxMs ?? 0}
              onChange={(value) => onChange(updateGapSize(term, "maxMs", Number(value) || 0))}
              size="sm"
              className="w-full"
            />
          </label>
        </div>
      );
    }
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
  slot,
  tileOptions,
  taskOptions,
  requirementOptions,
  maxDepth = 3,
  depth = 0,
}: {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  t: (k: string) => string;
  /** Identifies which store path this editor writes to. Used for test assertions and analytics. */
  slot?: "completion.root" | "recurring.condition";
  tileOptions?: { value: string; label: string }[];
  taskOptions?: { value: string; label: string }[];
  requirementOptions?: { value: string; label: string }[];
  maxDepth?: number;
  depth?: number;
}) {
  const isTerm = node.kind === ConditionKind.TERM;
  const isNot = node.kind === ConditionKind.NOT;
  const atDepthLimit = !isTerm && depth >= maxDepth;

  if (atDepthLimit) {
    return (
      <div className="flex flex-col gap-1">
        <ConditionKindSegmented value={node.kind as number} onChange={() => {}} t={t} />
        <p className="text-xs text-foreground-muted pl-1">{t("quickCreate.conditionDepthLimit")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid={slot ? `condition-editor-${slot}` : "condition-editor"}>
      <ConditionKindSegmented
        value={node.kind as number}
        onChange={(kind) => {
          if (kind === ConditionKind.TERM) {
            const currentTerm = node.term ?? defaultTerm("calendar");
            onChange({
              kind: kind as import("@/shared/model/v1/constants").ConditionKindValue,
              children: [],
              term: currentTerm,
            });
          } else if (kind === ConditionKind.NOT) {
            const firstChild =
              node.children.length > 0
                ? node.children[0]
                : { kind: ConditionKind.TERM, children: [], term: defaultTerm("calendar") };
            onChange({
              kind: kind as import("@/shared/model/v1/constants").ConditionKindValue,
              children: [firstChild],
              term: null,
            });
          } else {
            onChange({
              kind: kind as import("@/shared/model/v1/constants").ConditionKindValue,
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
            />
          ) : null}
        </>
      ) : (
        <>
          {node.children.map((child, i) => {
            return (
              <div
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                key={`${i}-${child.kind}-${child.term?.kind ?? "none"}`}
                className="flex flex-col gap-1"
              >
                <ConditionEditor
                  node={child}
                  onChange={(next) => {
                    const children = node.children.slice();
                    children[i] = next;
                    onChange({ ...node, children });
                  }}
                  t={t}
                  slot={slot}
                  tileOptions={tileOptions}
                  taskOptions={taskOptions}
                  requirementOptions={requirementOptions}
                  maxDepth={maxDepth}
                  depth={depth + 1}
                />
                {!isNot && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leftSection={<ChevronUp size={14} aria-hidden="true" />}
                      onClick={() => {
                        if (i === 0) return;
                        const children = node.children.slice();
                        [children[i - 1], children[i]] = [children[i], children[i - 1]];
                        onChange({ ...node, children });
                      }}
                      disabled={i === 0}
                      aria-label={t("quickCreate.conditionMoveUp")}
                      className="text-foreground-muted hover:text-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leftSection={<ChevronDown size={14} aria-hidden="true" />}
                      onClick={() => {
                        if (i >= node.children.length - 1) return;
                        const children = node.children.slice();
                        [children[i], children[i + 1]] = [children[i + 1], children[i]];
                        onChange({ ...node, children });
                      }}
                      disabled={i >= node.children.length - 1}
                      aria-label={t("quickCreate.conditionMoveDown")}
                      className="text-foreground-muted hover:text-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leftSection={<Trash2 size={14} aria-hidden="true" />}
                      onClick={() => {
                        const children = node.children.slice();
                        children.splice(i, 1);
                        onChange({ ...node, children });
                      }}
                      aria-label={t("quickCreate.conditionRemoveChild")}
                      className="text-foreground-muted hover:text-danger"
                    />
                  </div>
                )}
              </div>
            );
          })}
          {!isNot && (
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
          )}
        </>
      )}
    </div>
  );
}
