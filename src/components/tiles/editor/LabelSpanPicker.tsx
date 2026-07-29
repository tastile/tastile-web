"use client";

import { Button } from "@mantine/core";
import { useEffect, useState } from "react";

import {
  type ReferenceCatalogItem,
  ScheduleReferenceUsage,
  listReferenceCatalog,
} from "@/lib/api/v1/schedule-definition";
import { makeClient } from "@/lib/api/v1/submit";
import { useCurrentActorSubjectId } from "@/lib/hooks/use-current-actor";

import type { FloatingLabel } from "./floating-schedule";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; items: ReferenceCatalogItem[] }
  | { status: "ready"; items: ReferenceCatalogItem[] };

const ERROR_MESSAGE = "Could not load label spans.";

export function LabelSpanPicker({
  value,
  onChange,
}: {
  value: FloatingLabel | null;
  onChange: (label: FloatingLabel | null) => void;
}) {
  const ownerId = useCurrentActorSubjectId();
  const [state, setState] = useState<LoadState>(() =>
    ownerId ? { status: "loading" } : { status: "idle" },
  );

  useEffect(() => {
    if (!ownerId) return;
    let current = true;
    void listReferenceCatalog(makeClient(), ownerId, ScheduleReferenceUsage.LABEL_SPAN)
      .then((result) => {
        if (!current) return;
        if (result.ok) setState({ status: "ready", items: result.data });
        else setState({ status: "error", items: [] });
      })
      .catch(() => {
        if (current) setState({ status: "error", items: [] });
      });
    return () => {
      current = false;
    };
  }, [ownerId]);

  const items = state.status === "ready" || state.status === "error" ? state.items : [];
  const loading = state.status === "loading" || state.status === "idle";
  const error = state.status === "error" ? ERROR_MESSAGE : null;

  const reload = () => {
    if (!ownerId) return;
    setState({ status: "loading" });
    void listReferenceCatalog(makeClient(), ownerId, ScheduleReferenceUsage.LABEL_SPAN)
      .then((result) => {
        if (result.ok) setState({ status: "ready", items: result.data });
        else setState({ status: "error", items: [] });
      })
      .catch(() => setState({ status: "error", items: [] }));
  };

  return (
    <label className="block space-y-1">
      <span className="text-sm text-foreground">Available window</span>
      <select
        aria-label="Available window"
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
        <option value="">Choose a window</option>
        {items.map((item) => (
          <option key={item.placement_id} value={item.placement_id}>
            {item.title} (
            {new Date(item.span_start).toLocaleDateString("en-US", { timeZone: "UTC" })} –{" "}
            {new Date(item.span_end).toLocaleDateString("en-US", { timeZone: "UTC" })})
          </option>
        ))}
      </select>
      {loading ? <p className="text-xs text-foreground-muted">Loading label spans…</p> : null}
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs text-danger">
          <span>{error}</span>
          <Button type="button" onClick={reload} variant="outline" size="xs">
            Retry
          </Button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-xs text-foreground-muted">Create a usable label span first.</p>
      ) : null}
    </label>
  );
}
