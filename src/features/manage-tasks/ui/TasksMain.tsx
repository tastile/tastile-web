"use client";

import { makeClient } from "@/shared/api/v1/submit";
import {
  listPlacements,
  selectStartableOccurrences,
  type StartableOccurrenceCandidate,
} from "@/shared/api/v1/placements";
import { startExecutionCommand, startTileExecutionCommand } from "@/shared/api/v1/tile-commands";
import { useTileList } from "@/shared/hooks/use-tile-list";
import { useTranslation } from "@/shared/i18n/use-translation";
import { mapListView } from "@/shared/lib/map-list-view-to-tile";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import type { TileId } from "@/shared/model/ids";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { TileCardCompact } from "@/tile/ui/TileCardCompact";
import { Skeleton } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export function TasksMain() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const search = searchParams.get("q") ?? "";
  const range = searchParams.get("range") ?? "7d"; // default 7 days
  const granularity = searchParams.get("granularity") ?? "no_breaks,min_0m";
  const openEdit = useQuickCreateStore((s) => s.loadFromRecurringTile);
  const [startingTileId, setStartingTileId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [occurrencePicker, setOccurrencePicker] = useState<{
    tileId: string;
    candidates: StartableOccurrenceCandidate[];
  } | null>(null);

  const { tiles, loading, refresh } = useTileList({
    viewMode: "by_state",
    limit: 200,
    search: search || undefined,
    range,
    granularity,
  });

  const filterDesc = useMemo(() => {
    const parts = [];

    const num = Number.parseInt(range, 10);
    const unit = range.slice(-1);
    const unitStr =
      unit === "d"
        ? t("panels.tasks.days")
        : unit === "w"
          ? t("panels.tasks.weeks")
          : unit === "m"
            ? t("panels.tasks.months")
            : "";
    if (!Number.isNaN(num)) {
      parts.push(`${t("panels.tasks.filterRange")}: ${num} ${unitStr}`);
    }

    const gParts = granularity.split(",");
    const minPart = gParts.find((p) => p.startsWith("min_"));
    if (minPart) {
      const mins = minPart.replace("min_", "").replace("m", "");
      if (mins !== "0") {
        parts.push(`${t("panels.tasks.filterMinDuration")}: ${mins}m`);
      }
    }

    if (gParts.includes("important_only")) {
      parts.push(t("panels.tasks.highPriorityOnly"));
    }
    if (gParts.includes("no_low_priority")) {
      parts.push(t("panels.tasks.excludeLowPriority"));
    }

    if (search) {
      parts.push(`${t("panels.tasks.filterSearch")}: "${search}"`);
    }

    return parts.length > 0 ? parts.join(" • ") : t("panels.tasks.allTasks");
  }, [range, granularity, search, t]);

  const handleStart = useCallback(
    async (tileId: TileId) => {
      const id = tileId.toString();
      const item = tiles.find((tile) => tile.id === id);
      if (!item?.plan_id) {
        setStartError(t("panels.tasks.startErrorMissingPlan"));
        return;
      }

      const start = new Date();
      const end = new Date(start.getTime() + resolveStartDurationMs(item));
      setStartingTileId(id);
      setStartError(null);

      const result = await startTileExecutionCommand({
        client: makeClient(),
        tileId: id,
        planId: item.plan_id,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      setStartingTileId(null);
      if (!result.ok) {
        // core#277 / web#212: StartTile on a scheduled source with multiple
        // unfinished live segments fails closed with CONFLICT. Offer the
        // explicit-placement path instead of surfacing a raw error.
        if (
          result.error.kind === ApiErrorKind.CONFLICT &&
          result.error.message.includes("unfinished live segment")
        ) {
          const client = makeClient();
          const list = await listPlacements(client);
          if (list.ok) {
            const candidates = selectStartableOccurrences(list.data, {
              tileId: id,
              planId: item.plan_id,
            });
            if (candidates.length > 0) {
              setOccurrencePicker({ tileId: id, candidates });
              return;
            }
          }
        }
        setStartError(result.error.message);
        return;
      }

      window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
      window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
      await refresh();
    },
    [tiles, refresh],
  );

  const handleOccurrenceSelect = useCallback(
    async (placementId: string) => {
      setStartingTileId(occurrencePicker?.tileId ?? null);
      setStartError(null);
      const result = await startExecutionCommand({
        client: makeClient(),
        placementId,
      });
      setStartingTileId(null);
      setOccurrencePicker(null);
      if (!result.ok) {
        setStartError(result.error.message);
        return;
      }
      window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
      window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
      await refresh();
    },
    [occurrencePicker, refresh],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("panels.tasks.title")}
        description={t("tasks.subtitle")}
      />

      {/* Scope info bar: spacing (mt-2 + pb-3) carries the visual hierarchy
          from the section above (DS v2). */}
      <div className="mt-2 flex items-center justify-between pb-3 text-xs text-foreground-subtle">
        <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-caption text-foreground-lighter border border-border">
          {filterDesc}
        </span>
        <span className="font-mono text-caption text-foreground-lighter">
          {loading
            ? t("panels.projects.loadingProjects")
            : t("panels.projects.itemsFound", { count: tiles.length })}
        </span>
      </div>
      {startError ? (
        <div
          role="alert"
          className="mt-3 rounded bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {startError}
        </div>
      ) : null}
      {occurrencePicker ? (
        <div
          role="dialog"
          aria-label={t("panels.tasks.occurrencePickerTitle")}
          className="mt-3 rounded border border-border bg-surface-1 p-3"
        >
          <p className="text-sm font-medium text-foreground">
            {t("panels.tasks.occurrencePickerTitle")}
          </p>
          <p className="mt-1 text-xs text-foreground-subtle">
            {t("panels.tasks.occurrencePickerHint")}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {occurrencePicker.candidates.map((c) => (
              <li key={c.placementId}>
                <button
                  type="button"
                  disabled={startingTileId === occurrencePicker.tileId}
                  onClick={() => void handleOccurrenceSelect(c.placementId)}
                  className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="font-mono text-xs">
                    {c.spanStart ?? "—"} → {c.spanEnd ?? "—"}
                    {c.splitIndex !== null ? ` · #${c.splitIndex}` : ""}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    {t("panels.tasks.occurrenceStart")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOccurrencePicker(null)}
            className="mt-2 text-xs text-foreground-subtle hover:text-foreground"
          >
            {t("panels.tasks.occurrenceCancel")}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {!loading && tiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-subtle border border-border rounded-lg bg-surface-1">
            <p className="text-sm">{t("panels.tasks.empty")}</p>
          </div>
        )}
        {!loading && tiles.length > 0 && (
          <div className="border border-border bg-surface-1 rounded-lg overflow-hidden divide-y divide-border/40 shadow-xs">
            {tiles.map((t) => {
              const tile = mapListView(t);
              return (
                <TileCardCompact
                  key={t.id}
                  tile={tile}
                  listView={t}
                  onStart={startingTileId === t.id ? undefined : handleStart}
                  onEdit={(tileId) => {
                    // The QuickCreate store opens the panel first (in edit
                    // mode with the given tileId), then fetches the full
                    // Tile via getTile(id) and hydrates title/labels. Any
                    // fetch error is surfaced as a banner inside the panel.
                    void openEdit(tileId.toString());
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function resolveStartDurationMs(item: {
  target_work_min: number | null;
  target_rest_min: number | null;
}): number {
  const minutes = item.target_work_min ?? item.target_rest_min ?? 25;
  return Math.max(1, minutes) * 60_000;
}
