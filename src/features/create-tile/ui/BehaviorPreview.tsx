import { cn } from "@/shared/lib/cn";
import type { Locale } from "@/shared/stores/locale-store";
import type {
  RecurringSlice,
  SourceAuthoringSlice,
  TimeSlice,
} from "@/shared/stores/quick-create-store";
import type { Plan } from "@/tile/model/v1/tile";
import type { Window } from "@/tile/model/v1/window";
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
  t: (key: string) => string;
}

interface TimePreviewProps {
  time: TimeSlice;
  locale: Locale;
  t: (key: string) => string;
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
        <span>表示タイミング</span>
      </div>
      <div className="relative h-6 rounded-md bg-surface-0 border border-border/30 overflow-hidden">
        {[0, 6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full border-l border-border/20"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 text-[8px] text-foreground-muted/50">
              {h}
            </span>
          </div>
        ))}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-primary/30 border border-primary/50"
          style={{
            left: `${startPos}%`,
            width: `${barWidth}%`,
          }}
        />
      </div>
      <div className="text-[10px] text-foreground-muted">
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
  hasDuration: boolean;
}

function DurationPreview({ time, hasDuration }: DurationPreviewProps) {
  if (!hasDuration) return null;

  const min = time.durationMinMax.minMs ?? 0;
  const max = time.durationMinMax.maxMs ?? min;
  const maxScale = 180 * 60 * 1000;
  const minPercent = Math.min((min / maxScale) * 100, 100);
  const maxPercent = Math.min((max / maxScale) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Clock size={12} className="shrink-0" />
        <span>実行時間</span>
      </div>
      <div className="relative h-4 rounded-md bg-surface-0 border border-border/30 overflow-hidden">
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-blue-500/30 border border-blue-500/50"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(maxPercent - minPercent, 2)}%`,
          }}
        />
      </div>
      <div className="text-[10px] text-foreground-muted">
        {min !== null && max !== null
          ? `${Math.round(min / 60000)}〜${Math.round(max / 60000)}分`
          : min !== null
            ? `${Math.round(min / 60000)}分以上`
            : `${Math.round(max / 60000)}分以内`}
      </div>
    </div>
  );
}

interface RepeatPreviewProps {
  recurring: RecurringSlice;
  locale: Locale;
  hasRepeat: boolean;
}

function RepeatPreview({ recurring, locale, hasRepeat }: RepeatPreviewProps) {
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
            isActive ? "bg-primary" : "bg-surface-0 border border-border/50",
          )}
        />,
      );
    }
    return dots;
  };

  const getRepeatLabel = () => {
    switch (recurring.repeatMode) {
      case "daily":
        return "毎日";
      case "weekly": {
        const days = weekdayLabelsFor(locale).reduce<string>((acc, label, i) => {
          if ((recurring.weekdayMask & (1 << i)) !== 0) {
            return acc ? `${acc}, ${label}` : label;
          }
          return acc;
        }, "");
        return days || "毎週";
      }
      case "interval": {
        const unit =
          recurring.intervalUnit === "min"
            ? "分"
            : recurring.intervalUnit === "hour"
              ? "時間"
              : "日";
        return `${recurring.intervalValue}${unit}ごと`;
      }
      case "condition":
        return "繰り返し条件";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Repeat size={12} className="shrink-0" />
        <span>繰り返し</span>
      </div>
      <div className="flex items-center gap-0.5">{renderDots()}</div>
      <div className="text-[10px] text-foreground-muted">
        {getRepeatLabel()}
        {recurring.endDate && ` ~ ${recurring.endDate.slice(0, 10)}`}
      </div>
    </div>
  );
}

interface WindowPreviewProps {
  windows: Window[];
  t: (key: string) => string;
  hasWindows: boolean;
}

function WindowPreview({ windows, t, hasWindows }: WindowPreviewProps) {
  if (!hasWindows) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Layers size={12} className="shrink-0" />
        <span>時間帯</span>
      </div>
      <div className="relative h-6 rounded-md bg-surface-0 border border-border/30 overflow-hidden">
        {[0, 6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full border-l border-border/20"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {windows.map((w, i) => {
          const start = w.bounds.start ? parseTimeToPercent(w.bounds.start) : 0;
          const end = w.bounds.end ? parseTimeToPercent(w.bounds.end) : 100;
          return (
            <div
              key={w.id ?? i}
              className="absolute top-0.5 bottom-0.5 rounded-sm bg-green-500/30 border border-green-500/50"
              style={{
                left: `${start}%`,
                width: `${Math.max(end - start, 2)}%`,
              }}
            />
          );
        })}
      </div>
      <div className="text-[10px] text-foreground-muted">
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
}

function SourcePreview({ source }: SourcePreviewProps) {
  const splitLabel = source.splitPolicy.kind === 0 ? "分割なし" : "分割あり";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <SlidersHorizontal size={12} className="shrink-0" />
        <span>配置</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-sm",
                i < source.priority ? "bg-primary" : "bg-surface-0 border border-border/50",
              )}
            />
          ))}
        </div>
        <span className="text-[10px] text-foreground-muted">優先度{source.priority}</span>
      </div>
      <div className="text-[10px] text-foreground-muted">{splitLabel}</div>
    </div>
  );
}

interface RelationsPreviewProps {
  source: SourceAuthoringSlice;
  hasRelations: boolean;
}

function RelationsPreview({ source, hasRelations }: RelationsPreviewProps) {
  if (!hasRelations) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Link2 size={12} className="shrink-0" />
        <span>参照</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {source.relations.slice(0, 3).map((r) => (
          <div
            key={r.id}
            className="rounded-md bg-surface-0 border border-border/50 px-2 py-0.5 text-[10px] text-foreground"
          >
            {r.referencedTitle || "—"}
          </div>
        ))}
        {source.relations.length > 3 && (
          <div className="rounded-md bg-surface-0 border border-border/50 px-2 py-0.5 text-[10px] text-foreground-muted">
            +{source.relations.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}

interface TasksPreviewProps {
  plan: Plan;
  hasTasks: boolean;
}

function TasksPreview({ plan, hasTasks }: TasksPreviewProps) {
  if (!hasTasks) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <CheckCircle2 size={12} className="shrink-0" />
        <span>完了条件</span>
      </div>
      <div className="space-y-1">
        {plan.completion.tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-[10px] text-foreground">
            <div className="h-3 w-3 rounded-sm border border-border/50 bg-surface-0" />
            <span className="truncate">{task.content?.title || "(無題)"}</span>
          </div>
        ))}
        {plan.completion.tasks.length > 3 && (
          <div className="text-[10px] text-foreground-muted">
            +{plan.completion.tasks.length - 3}件
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
      classNames={{ item: "border-border/50 bg-surface-0" }}
    >
      <Accordion.Item value="behavior-preview">
        <Accordion.Control className="text-xs font-semibold text-foreground min-h-[36px] py-1">
          {t("quickCreate.behaviorPreviewTitle") || "このタイルの挙動"}
        </Accordion.Control>
        <Accordion.Panel>
          <div className="space-y-4">
            <TimePreview time={time} locale={locale} t={t} hasTimeSetting={hasTimeSetting} />
            <DurationPreview time={time} hasDuration={hasDuration} />
            <RepeatPreview recurring={recurring} locale={locale} hasRepeat={hasRepeat} />
            <WindowPreview windows={windows} t={t} hasWindows={hasWindows} />
            <SourcePreview source={source} />
            <RelationsPreview source={source} hasRelations={hasRelations} />
            <TasksPreview plan={plan} hasTasks={hasTasks} />
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
