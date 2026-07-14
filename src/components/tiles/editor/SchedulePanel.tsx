"use client";

/**
 * SchedulePanel — Plan §3 Time (Span / DurationRange) + §4 Windows.
 *
 * Extracted from QuickTileCreate.tsx during Plan #6 Phase 4. Hosts:
 *   - SectionHeader (Time)
 *   - RowToggle (allDay)
 *   - ScheduleRow (start / end pickers)
 *   - DurationRange inputs (minMs / maxMs in minutes)
 *   - SectionHeader (Windows)
 *   - WindowRow per window
 *   - Add Window button
 *
 * The §3 + §4 FormPanel/section wrapper stays in the shell (QuickTileCreate).
 * Phase 4 leaves the `referenceId` text input on WindowRow in place; future
 * commit will swap it for ReferencePicker.
 */

import { Calendar, Clock, Plus, Type, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/Button";
import {
  FormDivider,
  FormRow,
  RowInput,
  RowSegmented,
  RowToggle,
  SectionHeader,
} from "@/components/ui/form";
import type { Window } from "@/lib/domain/v1/window";
import { cn } from "@/lib/utils/cn";

import {
  type EditorLocale,
  formatDisplayDate,
  isoToLocalDate,
  isoToLocalDateTime,
  localDateTimeToIso,
  localDateToIsoDate,
} from "./date-utils";

const WINDOW_KIND_OPTIONS = [
  { value: "0", label: "quickCreate.windowKindCalendar" },
  { value: "1", label: "quickCreate.windowKindLabelSpan" },
  { value: "2", label: "quickCreate.windowKindParentSpan" },
  { value: "3", label: "quickCreate.windowKindGap" },
] as const;

// Re-exported so QuickTileCreate's base panel can keep its inline
// `<ScheduleRow>` after the helper moved out of that file. Plan #6 Phase 4
// removes this re-export once the base panel routes through SchedulePanel.
export { ScheduleRow };

interface ScheduleRowProps {
  allDay: boolean;
  spanStart: string;
  spanEnd: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

function ScheduleRow({
  allDay,
  spanStart,
  spanEnd,
  onStartChange,
  onEndChange,
  locale,
  t,
}: ScheduleRowProps) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
          {t("quickCreate.startAt")}
        </span>
        <button
          type="button"
          onClick={() => startInputRef.current?.showPicker()}
          className="w-full text-left rounded-md bg-surface-2 hover:bg-surface-3 transition-colors px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {formatDisplayDate(spanStart, allDay, locale, t)}
        </button>
        <input
          ref={startInputRef}
          type={allDay ? "date" : "datetime-local"}
          aria-label={`${t("quickCreate.startAt")} (${allDay ? t("tiles.inputDate") : t("tiles.inputDatetime")})`}
          value={allDay ? isoToLocalDate(spanStart) : isoToLocalDateTime(spanStart)}
          onChange={(e) =>
            onStartChange(
              allDay ? localDateToIsoDate(e.target.value) : localDateTimeToIso(e.target.value) ?? "",
            )
          }
          className="sr-only"
        />
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
          {t("quickCreate.endAt")}
        </span>
        <button
          type="button"
          onClick={() => endInputRef.current?.showPicker()}
          className="w-full text-left rounded-md bg-surface-2 hover:bg-surface-3 transition-colors px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {formatDisplayDate(spanEnd, allDay, locale, t)}
        </button>
        <input
          ref={endInputRef}
          type={allDay ? "date" : "datetime-local"}
          aria-label={`${t("quickCreate.endAt")} (${allDay ? t("tiles.inputDate") : t("tiles.inputDatetime")})`}
          value={allDay ? isoToLocalDate(spanEnd) : isoToLocalDateTime(spanEnd)}
          onChange={(e) =>
            onEndChange(
              allDay ? localDateToIsoDate(e.target.value) : localDateTimeToIso(e.target.value) ?? "",
            )
          }
          className="sr-only"
        />
      </div>
    </div>
  );
}

interface WindowRowProps {
  window: Window;
  index: number;
  onUpdate: (index: number, updater: (current: Window) => Window) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
  locale: EditorLocale;
}

function WindowRow({ window, index, onUpdate, onRemove, t, locale }: WindowRowProps) {
  const referenceKind = window.kind === 1 || window.kind === 2 || window.kind === 3;
  return (
    <div data-testid={`window-row-${index}`} className="space-y-2 border-l-2 border-surface-2 pl-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          {t("quickCreate.windowsTitle")} #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.windowRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </button>
      </div>
      <RowSegmented
        icon={Calendar}
        options={WINDOW_KIND_OPTIONS.map((opt) => ({
          value: opt.value,
          label: t(opt.label),
        }))}
        value={String(window.kind)}
        onChange={(value) => onUpdate(index, (w) => ({ ...w, kind: Number(value) }))}
      />
      <FormRow icon={<Calendar size={20} />}>
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(window.bounds.start)}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: {
                  ...w.bounds,
                  start: localDateTimeToIso(e.target.value) ?? "",
                },
              }))
            }
            className={cn(
              "themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40",
            )}
          />
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(window.bounds.end)}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: {
                  ...w.bounds,
                  end: localDateTimeToIso(e.target.value) ?? "",
                },
              }))
            }
            className={cn(
              "themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40",
            )}
          />
        </div>
      </FormRow>
      {referenceKind ? (
        <RowInput
          icon={Type}
          placeholder={t("quickCreate.windowReferenceIdLabel")}
          value={window.referenceId ?? ""}
          onChange={(value) =>
            onUpdate(index, (w) => ({
              ...w,
              referenceId: value.trim() ? value : null,
            }))
          }
          ariaLabel={t("quickCreate.windowReferenceIdLabel")}
        />
      ) : null}
    </div>
  );
}

export interface SchedulePanelProps {
  allDay: boolean;
  setAllDay: (value: boolean) => void;
  time: {
    span: { start: string; end: string };
    durationMinMax: { minMs: number | null; maxMs: number | null };
  };
  windows: Window[];
  setField: (path: string, value: unknown) => void;
  updateWindow: (index: number, updater: (current: Window) => Window) => void;
  addWindow: () => void;
  removeWindow: (index: number) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

export function SchedulePanel({
  allDay,
  setAllDay,
  time,
  windows,
  setField,
  updateWindow,
  addWindow,
  removeWindow,
  locale,
  t,
}: SchedulePanelProps) {
  return (
    <>
      <SectionHeader icon={Clock} title={t("quickCreate.timeNavTitle")} />
      <RowToggle
        icon={Calendar}
        placeholder={t("quickCreate.allDay")}
        checked={allDay}
        onChange={setAllDay}
      />
      <ScheduleRow
        allDay={allDay}
        spanStart={time.span.start}
        spanEnd={time.span.end}
        onStartChange={(value) => setField("time.span.start", value)}
        onEndChange={(value) => setField("time.span.end", value)}
        locale={locale}
        t={t}
      />
      <FormDivider />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
            {t("quickCreate.minMsLabel")}
          </span>
          <input
            type="number"
            min={0}
            step={5}
            aria-label={t("quickCreate.minMsLabel")}
            value={
              time.durationMinMax.minMs !== null
                ? Math.round(time.durationMinMax.minMs / 60000)
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              setField("time.durationMinMax.minMs", v === "" ? null : Number(v) * 60000);
            }}
            className="w-full rounded-md bg-surface-2 px-3 py-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
            {t("quickCreate.maxMsLabel")}
          </span>
          <input
            type="number"
            min={0}
            step={5}
            aria-label={t("quickCreate.maxMsLabel")}
            value={
              time.durationMinMax.maxMs !== null
                ? Math.round(time.durationMinMax.maxMs / 60000)
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              setField("time.durationMinMax.maxMs", v === "" ? null : Number(v) * 60000);
            }}
            className="w-full rounded-md bg-surface-2 px-3 py-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <p className="mt-1 text-[10px] text-foreground-muted">{t("quickCreate.minutesUnit")}</p>
      <FormDivider />
      <SectionHeader icon={Calendar} title={t("quickCreate.windowsNavTitle")} />
      {windows.map((w, i) => (
        <WindowRow
          key={w.id}
          window={w}
          index={i}
          onUpdate={updateWindow}
          onRemove={removeWindow}
          t={t}
          locale={locale}
        />
      ))}
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={addWindow}
      >
        {t("quickCreate.windowsAdd")}
      </Button>
    </>
  );
}