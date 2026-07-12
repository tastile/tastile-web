"use client";

import { useCallback, useEffect, useState } from "react";

import {
  listReferenceCatalog,
  type ReferenceCatalogItem,
  ScheduleReferenceUsage,
} from "@/lib/api/v1/schedule-definition";
import { makeClient } from "@/lib/api/v1/submit";
import { useCurrentActorSubjectId } from "@/lib/hooks/use-current-actor";

import type { FloatingLabel } from "./floating-schedule";

export function LabelSpanPicker({
  value,
  onChange,
}: {
  value: FloatingLabel | null;
  onChange: (label: FloatingLabel | null) => void;
}) {
  const ownerId = useCurrentActorSubjectId();
  const [items, setItems] = useState<ReferenceCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    void listReferenceCatalog(makeClient(), ownerId, ScheduleReferenceUsage.LABEL_SPAN)
      .then((result) => {
        if (result.ok) {
          setItems(result.data);
        } else {
          setItems([]);
          setError("期間ラベルを読み込めませんでした。");
        }
      })
      .catch(() => setError("期間ラベルを読み込めませんでした。"))
      .finally(() => {
        setLoading(false);
      });
  }, [ownerId]);

  useEffect(() => {
    let current = true;
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    void listReferenceCatalog(makeClient(), ownerId, ScheduleReferenceUsage.LABEL_SPAN)
      .then((result) => {
        if (!current) return;
        if (result.ok) setItems(result.data);
        else setError("期間ラベルを読み込めませんでした。");
      })
      .catch(() => current && setError("期間ラベルを読み込めませんでした。"))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [ownerId]);

  return (
    <label className="block space-y-1">
      <span className="text-sm text-foreground">配置できる期間</span>
      <select
        aria-label="配置できる期間"
        value={value?.placementId ?? ""}
        onChange={(event) => {
          const item = items.find((candidate) => candidate.placement_id === event.target.value);
          onChange(
            item
              ? {
                  placementId: item.placement_id,
                  title: item.title,
                  start: item.span_start,
                  end: item.span_end,
                }
              : null,
          );
        }}
        className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">期間を選ぶ</option>
        {items.map((item) => (
          <option key={item.placement_id} value={item.placement_id}>
            {item.title}（{new Date(item.span_start).toLocaleDateString()} –{" "}
            {new Date(item.span_end).toLocaleDateString()}）
          </option>
        ))}
      </select>
      {loading ? <p className="text-xs text-foreground-muted">期間を読み込み中…</p> : null}
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs text-danger">
          <span>{error}</span>
          <button type="button" onClick={load} className="underline">
            再試行
          </button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-xs text-foreground-muted">使える期間ラベルを先に作成してください。</p>
      ) : null}
    </label>
  );
}
