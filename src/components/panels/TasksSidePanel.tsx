"use client";

import { Button, NumberInput, Slider, Switch, TextInput } from "@mantine/core";
import { Clock, Flame, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { useTranslation } from "@/lib/i18n/use-translation";

type RangeUnit = "d" | "w" | "m";
const VALID_RANGE_UNITS: RangeUnit[] = ["d", "w", "m"];
const DEFAULT_RANGE = { val: 7, unit: "d" as RangeUnit };

function parseRangeParam(raw: string): { val: number; unit: RangeUnit } {
  const num = parseInt(raw, 10);
  const unit = raw.slice(-1) as RangeUnit;
  if (!Number.isNaN(num) && VALID_RANGE_UNITS.includes(unit)) return { val: num, unit };
  return DEFAULT_RANGE;
}

function parseGranularityParam(raw: string): {
  minDuration: number;
  highPriorityOnly: boolean;
  excludeLowPriority: boolean;
} {
  const parts = raw.split(",");
  const minPart = parts.find((p) => p.startsWith("min_"));
  let minDuration = 0;
  if (minPart) {
    const minutes = parseInt(minPart.replace("min_", "").replace("m", ""), 10);
    if (!Number.isNaN(minutes)) minDuration = minutes;
  }
  return {
    minDuration,
    highPriorityOnly: parts.includes("important_only"),
    excludeLowPriority: parts.includes("no_low_priority"),
  };
}

export function TasksSidePanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Pull initial values from URL params; fall back to defaults when absent.
  const search = searchParams.get("q") ?? "";
  const rawRange = searchParams.get("range") ?? "7d"; // default 7 days
  const rawGranularity = searchParams.get("granularity") ?? "no_breaks,min_0m";

  // Parse the URL params once via lazy state initializers — the first render
  // already reflects the URL, no effect, no extra render. The URL is the
  // source of truth: applyFilters() pushes values back into the URL, and the
  // state mirrors them via the controlled inputs.
  const initialRange = parseRangeParam(rawRange);
  const initialGranularity = parseGranularityParam(rawGranularity);

  const [rangeVal, setRangeVal] = useState<number>(initialRange.val);
  const [rangeUnit, setRangeUnit] = useState<"d" | "w" | "m">(initialRange.unit);

  const [minDuration, setMinDuration] = useState<number>(initialGranularity.minDuration);

  const [highPriorityOnly, setHighPriorityOnly] = useState<boolean>(
    initialGranularity.highPriorityOnly,
  );
  const [excludeLowPriority, setExcludeLowPriority] = useState<boolean>(
    initialGranularity.excludeLowPriority,
  );

  // Shared helper that mirrors filters into the URL — always writes all values.
  function applyFilters(updates: {
    range?: { val: number; unit: "d" | "w" | "m" };
    duration?: { val: number };
    priority?: { high: boolean; nolow: boolean };
    q?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    // Search query.
    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
    }

    // Time range (always set).
    const targetRange = updates.range ?? { val: rangeVal, unit: rangeUnit };
    params.set("range", `${targetRange.val}${targetRange.unit}`);

    // Granularity (Duration + Priority — always set).
    const targetDuration = updates.duration ?? { val: minDuration };
    const targetPriority = updates.priority ?? {
      high: highPriorityOnly,
      nolow: excludeLowPriority,
    };

    const parts = ["no_breaks"];
    // Always set min_0m explicitly, even when 0, since "disabled" is no longer an option.
    parts.push(`min_${targetDuration.val}m`);

    if (targetPriority.high) {
      parts.push("important_only");
    }
    if (targetPriority.nolow) {
      parts.push("no_low_priority");
    }

    params.set("granularity", parts.join(","));

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  // Reset to the default filter state.
  function resetToDefaults() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("range", "7d");
    params.set("granularity", "no_breaks,min_0m");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-6 pt-2 select-none">
      <TasksSearchSection search={search} onApply={applyFilters} t={t} />
      <TasksTimeRangeSection
        rangeVal={rangeVal}
        rangeUnit={rangeUnit}
        setRangeVal={setRangeVal}
        setRangeUnit={setRangeUnit}
        onApply={applyFilters}
        t={t}
      />
      <TasksMinDurationSection
        minDuration={minDuration}
        setMinDuration={setMinDuration}
        onApply={applyFilters}
        t={t}
      />
      <TasksPrioritySection
        highPriorityOnly={highPriorityOnly}
        excludeLowPriority={excludeLowPriority}
        setHighPriorityOnly={setHighPriorityOnly}
        setExcludeLowPriority={setExcludeLowPriority}
        onApply={applyFilters}
        t={t}
      />
      <div className="px-3 border-t border-border/40 pt-4">
        <Button
          variant="default"
          leftSection={<RefreshCw className="h-3.5 w-3.5 text-foreground-subtle" />}
          fullWidth
          type="button"
          onClick={resetToDefaults}
          data-testid="tasks-reset-defaults"
        >
          {t("panels.tasks.resetToDefaults")}
        </Button>
      </div>
    </div>
  );
}

function TasksSearchSection({
  search,
  onApply,
  t,
}: {
  search: string;
  onApply: (updates: { q?: string }) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="px-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
        {t("panels.tasks.search")}
      </p>
      <TextInput
        leftSection={<Search className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden />}
        placeholder={t("panels.tasks.searchPlaceholder")}
        value={search}
        onChange={(event) => onApply({ q: event.currentTarget.value })}
        size="xs"
        data-testid="tasks-search"
        aria-label={t("panels.tasks.search")}
      />
    </div>
  );
}

function TasksTimeRangeSection({
  rangeVal,
  rangeUnit,
  setRangeVal,
  setRangeUnit,
  onApply,
  t,
}: {
  rangeVal: number;
  rangeUnit: "d" | "w" | "m";
  setRangeVal: (val: number) => void;
  setRangeUnit: (unit: "d" | "w" | "m") => void;
  onApply: (updates: { range?: { val: number; unit: "d" | "w" | "m" } }) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="px-3 border-t border-border/40 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-foreground-subtle" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
            {t("panels.tasks.timeRange")}
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium text-foreground-muted">
          {rangeVal}{" "}
          {rangeUnit === "d"
            ? t("panels.tasks.days")
            : rangeUnit === "w"
              ? t("panels.tasks.weeks")
              : t("panels.tasks.months")}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-20">
            <NumberInput
              value={rangeVal}
              min={1}
              max={365}
              size="xs"
              onChange={(value) => {
                const val = Math.max(1, Number(value) || 1);
                setRangeVal(val);
                onApply({ range: { val, unit: rangeUnit } });
              }}
              aria-label={t("panels.tasks.timeRange")}
              data-testid="tasks-range-num"
            />
          </div>
          <div className="flex-1">
            <Dropdown
              value={rangeUnit}
              onChange={(val) => {
                const unit = val as "d" | "w" | "m";
                setRangeUnit(unit);
                onApply({ range: { val: rangeVal, unit } });
              }}
              size="small"
              items={[
                { value: "d", label: t("panels.tasks.days") },
                { value: "w", label: t("panels.tasks.weeks") },
                { value: "m", label: t("panels.tasks.months") },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center px-1">
          <Slider
            min={1}
            max={rangeUnit === "d" ? 90 : rangeUnit === "w" ? 12 : 6}
            value={rangeVal}
            onChange={(value) => {
              setRangeVal(value);
              onApply({ range: { val: value, unit: rangeUnit } });
            }}
            size="sm"
            className="w-full"
            data-testid="tasks-range-slider"
          />
        </div>
      </div>
    </div>
  );
}

function TasksMinDurationSection({
  minDuration,
  setMinDuration,
  onApply,
  t,
}: {
  minDuration: number;
  setMinDuration: (val: number) => void;
  onApply: (updates: { duration?: { val: number } }) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="px-3 border-t border-border/40 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-foreground-subtle" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
            {t("panels.tasks.minDuration")}
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium text-foreground-muted">
          {minDuration} {t("panels.tasks.minUnit")}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <NumberInput
            value={minDuration}
            min={0}
            max={240}
            size="xs"
            suffix={t("panels.tasks.minutes")}
            onChange={(value) => {
              const val = Math.max(0, Number(value) || 0);
              setMinDuration(val);
              onApply({ duration: { val } });
            }}
            aria-label={t("panels.tasks.minDuration")}
            data-testid="tasks-duration-num"
          />
        </div>

        <div className="flex items-center px-1">
          <Slider
            min={0}
            max={120}
            step={5}
            value={minDuration}
            onChange={(value) => {
              setMinDuration(value);
              onApply({ duration: { val: value } });
            }}
            size="sm"
            className="w-full"
            data-testid="tasks-duration-slider"
          />
        </div>
      </div>
    </div>
  );
}

function TasksPrioritySection({
  highPriorityOnly,
  excludeLowPriority,
  setHighPriorityOnly,
  setExcludeLowPriority,
  onApply,
  t,
}: {
  highPriorityOnly: boolean;
  excludeLowPriority: boolean;
  setHighPriorityOnly: (val: boolean) => void;
  setExcludeLowPriority: (val: boolean) => void;
  onApply: (updates: { priority?: { high: boolean; nolow: boolean } }) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="px-3 border-t border-border/40 pt-4">
      <div className="mb-3 flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 text-foreground-subtle" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
          {t("panels.tasks.priorityFilter")}
        </p>
      </div>

      <div className="space-y-3">
        <Switch
          label={t("panels.tasks.highPriorityOnly")}
          checked={highPriorityOnly}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setHighPriorityOnly(checked);
            onApply({ priority: { high: checked, nolow: excludeLowPriority } });
          }}
          size="sm"
          data-testid="tasks-high-priority-switch"
        />

        <Switch
          label={t("panels.tasks.excludeLowPriority")}
          checked={excludeLowPriority}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setExcludeLowPriority(checked);
            onApply({ priority: { high: highPriorityOnly, nolow: checked } });
          }}
          size="sm"
          data-testid="tasks-exclude-low-switch"
        />
      </div>
    </div>
  );
}
