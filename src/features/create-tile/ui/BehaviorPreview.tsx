import { cn } from "@/shared/lib/cn";
import type { Plan } from "@/shared/model/v1/tile-types";
import type { Window } from "@/shared/model/v1/window";
import type { Locale } from "@/shared/stores/locale-store";
import type {
  RecurringSlice,
  SourceAuthoringSlice,
  TimeSlice,
} from "@/shared/stores/quick-create-store";
import { Accordion } from "@mantine/core";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Link2,
  Repeat,
  SlidersHorizontal,
} from "lucide-react";
import { formatDisplayDate, parseTimeToPercent, weekdayLabelsFor } from "./quick-create-utils";

export interface BehaviorPreviewProps {
  plan: Plan;
  time: TimeSlice;
  windows: Window[];
  recurring: RecurringSlice;
  source: SourceAuthoringSlice;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface TimePreviewProps {
  time: TimeSlice;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  hasTimeSetting: boolean;
}

function TimePreview({ time, locale, t, hasTimeSetting }: TimePreviewProps) {
  if (!hasTimeSetting) return null;

  const getBarPosition = (iso: string | null): number => {
    if (!iso) return 0;
    const date = new Date(iso);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return ((hours * 60 + minutes) / (24 * 60)) * 100;
  };

  const startPos = time.span.start ? getBarPosition(time.span.start) : 0;
  const endPos = time.span.end ? getBarPosition(time.span.end) : 100;
  const barWidth = endPos - startPos || 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Calendar size={12} className="shrink-0" />
        <span>{t("behaviorPreviewScheduleLabel")}</span>
      </div>
      <div className="relative h-6 rounded-md bg-surface-0 overflow-hidden">
        {[0, 6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 text-caption text-foreground-muted/50">
              {h}
            </span>
          </div>
        ))}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-primary/30"
          style={{
            left: `${startPos}%`,
            width: `${barWidth}%`,
          }}
        />
      </div>
      <div className="text-caption text-foreground-muted">
        {time.whenMode === "day" && time.span.start
          ? formatDisplayDate(time.span.start, true, locale, t)
          : time.whenMode === "reference"
            ? t("quickCreate.referenceRangeTitle")
            : time.span.start || time.span.end
              ? `${time.span.start ? formatDisplayDate(time.span.start, false, locale, t) : "—"} → ${time.span.end ? formatDisplayDate(time.span.end, false, locale, t) : "—"}`
              : t("quickCreate.whenNoneTitle")}
      </div>
    </div>
  );
}

interface DurationPreviewProps {
  time: TimeSlice;
  t: (key: string, params?: Record<string, string | number>) => string;
  hasDuration: boolean;
}

function DurationPreview({ time, t, hasDuration }: DurationPreviewProps) {
  if (!hasDuration) return null;

  const min = time.durationMinMax.minMs ?? 0;
  const max = time.durationMinMax.maxMs ?? min;
  const maxScale = 180 * 60 * 1000;
  const minPercent = Math.min((min / maxScale) * 100, 100);
  const maxPercent = Math.min((max / maxScale) * 100, 100);
  const minuteUnit = t("behaviorPreviewRepeatIntervalUnitMin");

  const formatMin = (ms: number) => `${Math.round(ms / 60000)}${minuteUnit}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Clock size={12} className="shrink-0" />
        <span>{t("behaviorPreviewExecutionTimeLabel")}</span>
      </div>
      <div className="relative h-4 rounded-md bg-surface-0 overflow-hidden">
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-blue-500/30"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(maxPercent - minPercent, 2)}%`,
          }}
        />
      </div>
      <div className="text-caption text-foreground-muted">
        {min !== null && max !== null
          ? `${formatMin(min)}〜${formatMin(max)}`
          : min !== null
            ? `${formatMin(min)}以上`
            : `${formatMin(max)}以内`}
      </div>
    </div>
  );
}

interface RepeatPreviewProps {
  recurring: RecurringSlice;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  hasRepeat: boolean;
}

function RepeatPreview({ recurring, locale, t, hasRepeat }: RepeatPreviewProps) {
  if (!hasRepeat) return null;

  const renderDots = () => {
    const dots: React.ReactNode[] = [];
    const totalDots = 14;
    const activeDaySet = new Set<number>();

    switch (recurring.repeatMode) {
      case "daily":
        for (let i = 0; i < totalDots; i++) activeDaySet.add(i);
        break;
      case "weekly":
        for (let i = 0; i < totalDots; i++) {
          const dayOfWeek = i % 7;
          if ((recurring.weekdayMask & (1 << dayOfWeek)) !== 0) {
            activeDaySet.add(i);
          }
        }
        break;
      case "interval": {
        const intervalDays =
          recurring.intervalUnit === "day"
            ? recurring.intervalValue
            : recurring.intervalUnit === "hour"
              ? recurring.intervalValue / 24
              : recurring.intervalValue * 7;
        for (let i = 0; i < totalDots; i++) {
          if (i % Math.max(Math.round(intervalDays), 1) === 0) {
            activeDaySet.add(i);
          }
        }
        break;
      }
      default:
        break;
    }

    for (let i = 0; i < totalDots; i++) {
      const isActive = activeDaySet.has(i);
      dots.push(
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            isActive ? "bg-primary" : "bg-surface-0",
          )}
        />,
      );
    }
    return dots;
  };

  const getRepeatLabel = () => {
    switch (recurring.repeatMode) {
      case "daily":
        return t("behaviorPreviewRecurrenceKindDaily");
      case "weekly": {
        const days = weekdayLabelsFor(locale).reduce<string>((acc, label, i) => {
          if ((recurring.weekdayMask & (1 << i)) !== 0) {
            return acc ? `${acc}, ${label}` : label;
          }
          return acc;
        }, "");
        return days || t("behaviorPreviewRecurrenceKindWeekly");
      }
      case "interval": {
        const unitKey =
          recurring.intervalUnit === "min"
            ? "behaviorPreviewRepeatIntervalUnitMin"
            : recurring.intervalUnit === "hour"
              ? "behaviorPreviewRepeatIntervalUnitHour"
              : "behaviorPreviewRepeatIntervalUnitDay";
        return t("behaviorPreviewRepeatInterval", {
          value: recurring.intervalValue,
          unit: t(unitKey),
        });
      }
      case "condition":
        return t("behaviorPreviewRecurrenceKindInterval");
      default:
        return "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Repeat size={12} className="shrink-0" />
        <span>{t("behaviorPreviewRecurrenceLabel")}</span>
      </div>
      <div className="flex items-center gap-0.5">{renderDots()}</div>
      <div className="text-caption text-foreground-muted">
        {getRepeatLabel()}
        {recurring.endDate && ` ~ ${recurring.endDate.slice(0, 10)}`}
      </div>
    </div>
  );
}

interface WindowPreviewProps {
  windows: Window[];
  t: (key: string, params?: Record<string, string | number>) => string;
  hasWindows: boolean;
}

function WindowPreview({ windows, t, hasWindows }: WindowPreviewProps) {
  if (!hasWindows) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Layers size={12} className="shrink-0" />
        <span>{t("behaviorPreviewWindowLabel")}</span>
      </div>
      <div className="relative h-6 rounded-md bg-surface-0 overflow-hidden">
        {[0, 6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {windows.map((w, i) => {
          const start = w.bounds.start ? parseTimeToPercent(w.bounds.start) : 0;
          const end = w.bounds.end ? parseTimeToPercent(w.bounds.end) : 100;
          return (
            <div
              key={w.id ?? i}
              className="absolute top-0.5 bottom-0.5 rounded-sm bg-green-500/30"
              style={{
                left: `${start}%`,
                width: `${Math.max(end - start, 2)}%`,
              }}
            />
          );
        })}
      </div>
      <div className="text-caption text-foreground-muted">
        {windows
          .map((w) => {
            if (w.bounds.start && w.bounds.end) {
              return `${w.bounds.start}〜${w.bounds.end}`;
            }
            return t("quickCreate.conditionWindowOpen");
          })
          .join(", ")}
      </div>
    </div>
  );
}

interface SourcePreviewProps {
  source: SourceAuthoringSlice;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function SourcePreview({ source, t }: SourcePreviewProps) {
  const splitLabel =
    source.splitPolicy.kind === 0
      ? t("behaviorPreviewSplitAllow")
      : t("behaviorPreviewSplitKeep");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <SlidersHorizontal size={12} className="shrink-0" />
        <span>{t("behaviorPreviewPlacementLabel")}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-sm",
                i < source.priority ? "bg-primary" : "bg-surface-0",
              )}
            />
          ))}
        </div>
        <span className="text-caption text-foreground-muted">
          {t("behaviorPreviewPriorityPrefix", { value: source.priority })}
        </span>
      </div>
      <div className="text-caption text-foreground-muted">{splitLabel}</div>
    </div>
  );
}

interface RelationsPreviewProps {
  source: SourceAuthoringSlice;
  t: (key: string, params?: Record<string, string | number>) => string;
  hasRelations: boolean;
}

function RelationsPreview({ source, t, hasRelations }: RelationsPreviewProps) {
  if (!hasRelations) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Link2 size={12} className="shrink-0" />
        <span>{t("behaviorPreviewReferenceLabel")}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {source.relations.slice(0, 3).map((r) => (
          <div
            key={r.id}
            className="rounded-md bg-surface-0 px-2 py-0.5 text-caption text-foreground"
          >
            {r.referencedTitle || "—"}
          </div>
        ))}
        {source.relations.length > 3 && (
          <div className="rounded-md bg-surface-0 px-2 py-0.5 text-caption text-foreground-muted">
            +{source.relations.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}

interface TasksPreviewProps {
  plan: Plan;
  t: (key: string, params?: Record<string, string | number>) => string;
  hasTasks: boolean;
}

function TasksPreview({ plan, t, hasTasks }: TasksPreviewProps) {
  if (!hasTasks) return null;

  const untitled = t("behaviorPreviewUntitledFallback");
  const moreCount = t("quickCreate.panel.behaviorPreview.moreCount");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <CheckCircle2 size={12} className="shrink-0" />
        <span>{t("behaviorPreviewObjectiveLabel")}</span>
      </div>
      <div className="space-y-1">
        {plan.completion.tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-caption text-foreground">
            <div className="h-3 w-3 rounded-sm bg-surface-0" />
            <span className="truncate">{task.content?.title || untitled}</span>
          </div>
        ))}
        {plan.completion.tasks.length > 3 && (
          <div className="text-caption text-foreground-muted">
            +{plan.completion.tasks.length - 3}
            {moreCount}
          </div>
        )}
      </div>
    </div>
  );
}

export function BehaviorPreview({
  plan,
  time,
  windows,
  recurring,
  source,
  locale,
  t,
}: BehaviorPreviewProps) {
  const hasDuration = time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null;
  const hasWindows = windows.length > 0;
  const hasRepeat = recurring.repeatMode !== "once";
  const hasRelations = source.relations.length > 0;
  const hasFlows = source.flowSequences.length > 0;
  const hasTasks = plan.completion.tasks.length > 0;
  const hasTimeSetting = time.whenMode !== "none";

  const hasAnyPreview =
    hasTimeSetting ||
    hasDuration ||
    hasRepeat ||
    hasWindows ||
    hasRelations ||
    hasFlows ||
    hasTasks;

  if (!hasAnyPreview) {
    return null;
  }

  return (
    <Accordion
      variant="separated"
      radius="md"
      classNames={{ item: "bg-surface-0" }}
    >
      <Accordion.Item value="behavior-preview">
        <Accordion.Control className="text-xs font-semibold text-foreground min-h-[36px] py-1">
          {t("quickCreate.behaviorPreviewTitle")}
        </Accordion.Control>
        <Accordion.Panel>
          <div className="space-y-4">
            <TimePreview time={time} locale={locale} t={t} hasTimeSetting={hasTimeSetting} />
            <DurationPreview time={time} t={t} hasDuration={hasDuration} />
            <RepeatPreview recurring={recurring} locale={locale} t={t} hasRepeat={hasRepeat} />
            <WindowPreview windows={windows} t={t} hasWindows={hasWindows} />
            <SourcePreview source={source} t={t} />
            <RelationsPreview source={source} t={t} hasRelations={hasRelations} />
            <TasksPreview plan={plan} t={t} hasTasks={hasTasks} />
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
