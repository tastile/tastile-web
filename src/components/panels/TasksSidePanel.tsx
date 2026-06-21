"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Flame, ShieldAlert, Clock, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function TasksSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // URLパラメータからの初期値取得（無ければデフォルト値を設定）
  const search = searchParams.get("q") ?? "";
  const rawRange = searchParams.get("range") ?? "7d"; // デフォルト7日
  const rawGranularity = searchParams.get("granularity") ?? "no_breaks,min_0m";

  // Range の内部状態 (数値と単位の分離パース)
  const [rangeVal, setRangeVal] = useState<number>(7);
  const [rangeUnit, setRangeUnit] = useState<"d" | "w" | "m">("d");

  // Min Duration の内部状態
  const [minDuration, setMinDuration] = useState<number>(0);

  // Priority の内部状態
  const [highPriorityOnly, setHighPriorityOnly] = useState<boolean>(false);
  const [excludeLowPriority, setExcludeLowPriority] = useState<boolean>(false);

  // パラメータ変更 of 初期同期
  useEffect(() => {
    // Rangeの同期
    const num = parseInt(rawRange);
    const unit = rawRange.slice(-1) as "d" | "w" | "m";
    if (!isNaN(num) && ["d", "w", "m"].includes(unit)) {
      setRangeVal(num);
      setRangeUnit(unit);
    } else {
      setRangeVal(7);
      setRangeUnit("d");
    }

    // Granularityの同期
    const gParts = rawGranularity.split(",");
    
    // min_Xm の同期
    const minPart = gParts.find((p) => p.startsWith("min_"));
    if (minPart) {
      const minutes = parseInt(minPart.replace("min_", "").replace("m", ""));
      if (!isNaN(minutes)) {
        setMinDuration(minutes);
      }
    } else {
      setMinDuration(0);
    }

    // Priorityの同期
    setHighPriorityOnly(gParts.includes("important_only"));
    setExcludeLowPriority(gParts.includes("no_low_priority"));
  }, [rawRange, rawGranularity]);

  // パラメータをURLに反映する共通関数 (常にすべての値を乗せる)
  function applyFilters(updates: {
    range?: { val: number; unit: "d" | "w" | "m" };
    duration?: { val: number };
    priority?: { high: boolean; nolow: boolean };
    q?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    // 検索クエリ
    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
    }

    // Time Range (常に設定)
    const targetRange = updates.range ?? { val: rangeVal, unit: rangeUnit };
    params.set("range", `${targetRange.val}${targetRange.unit}`);

    // Granularity (Duration + Priority - 常に設定)
    const targetDuration = updates.duration ?? { val: minDuration };
    const targetPriority = updates.priority ?? { high: highPriorityOnly, nolow: excludeLowPriority };

    const parts = ["no_breaks"];
    // 0分であっても常に min_0m を明示的に設定する（無効という選択肢を廃止）
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

  // デフォルト状態にリセット
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
      {/* 検索 */}
      <div className="px-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
          Search
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => applyFilters({ q: e.target.value })}
            className="h-8 w-full rounded-md border border-border bg-surface-1 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Time Range */}
      <div className="px-3 border-t border-border/40 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-foreground-subtle" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
              Time Range
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-foreground-muted">
            {rangeVal} {rangeUnit === "d" ? "days" : rangeUnit === "w" ? "weeks" : "months"}
          </span>
        </div>

        {/* コントロール群 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Input
                type="number"
                min="1"
                max="365"
                value={rangeVal}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setRangeVal(val);
                  applyFilters({ range: { val, unit: rangeUnit } });
                }}
                className="h-8"
              />
            </div>
            <div className="flex-1">
              <Select
                value={rangeUnit}
                onChange={(e) => {
                  const val = e.target.value as "d" | "w" | "m";
                  setRangeUnit(val);
                  applyFilters({ range: { val: rangeVal, unit: val } });
                }}
                className="h-8 text-xs"
              >
                <option value="d">Days</option>
                <option value="w">Weeks</option>
                <option value="m">Months</option>
              </Select>
            </div>
          </div>

          {/* カスタムスライダー */}
          <div className="flex items-center px-1">
            <input
              type="range"
              min="1"
              max={rangeUnit === "d" ? 90 : rangeUnit === "w" ? 12 : 6}
              value={rangeVal}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setRangeVal(val);
                applyFilters({ range: { val, unit: rangeUnit } });
              }}
              className="w-full h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>
        </div>
      </div>

      {/* Min Duration */}
      <div className="px-3 border-t border-border/40 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-foreground-subtle" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
              Min Duration
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-foreground-muted">
            {minDuration} min
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <Input
              type="number"
              min="0"
              max="240"
              value={minDuration}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                setMinDuration(val);
                applyFilters({ duration: { val } });
              }}
              trailing={<span className="text-[10px] text-foreground-subtle select-none">minutes</span>}
              className="h-8"
            />
          </div>

          <div className="flex items-center px-1">
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={minDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setMinDuration(val);
                applyFilters({ duration: { val } });
              }}
              className="w-full h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>
        </div>
      </div>

      {/* Priority Filters */}
      <div className="px-3 border-t border-border/40 pt-4">
        <div className="mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-foreground-subtle" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
            Priority Filter
          </p>
        </div>

        <div className="space-y-3">
          {/* High Priority Switch */}
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs text-foreground-subtle group-hover:text-foreground transition-colors">High Priority Only</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={highPriorityOnly}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHighPriorityOnly(checked);
                  applyFilters({ priority: { high: checked, nolow: excludeLowPriority } });
                }}
                className="sr-only peer"
              />
              <div className={cn(
                "w-9 h-5 rounded-full transition-colors cursor-pointer border border-transparent outline-none",
                "bg-surface-3 peer-checked:bg-primary",
                "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm",
                "peer-checked:after:translate-x-4"
              )} />
            </div>
          </label>

          {/* Exclude Low Priority Switch */}
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs text-foreground-subtle group-hover:text-foreground transition-colors">Exclude Low Priority</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={excludeLowPriority}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setExcludeLowPriority(checked);
                  applyFilters({ priority: { high: highPriorityOnly, nolow: checked } });
                }}
                className="sr-only peer"
              />
              <div className={cn(
                "w-9 h-5 rounded-full transition-colors cursor-pointer border border-transparent outline-none",
                "bg-surface-3 peer-checked:bg-primary",
                "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm",
                "peer-checked:after:translate-x-4"
              )} />
            </div>
          </label>
        </div>
      </div>

      {/* Reset to Defaults Button */}
      <div className="px-3 border-t border-border/40 pt-4">
        <button
          type="button"
          onClick={resetToDefaults}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded border border-border text-foreground bg-surface-2 hover:bg-surface-3 transition-all cursor-pointer shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-foreground-subtle" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
