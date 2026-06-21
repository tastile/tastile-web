"use client";

import {
  Coffee,
  Loader2,
  Pause,
  PauseCircle,
  Play,
  RefreshCw,
  Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill, StatusDot } from "@/components/ui/StatusDot";
import { Actor } from "@/lib/domain/actor";
import type { Tile } from "@/lib/domain/tile";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";

const BREAK_PRESETS = [5, 10, 15, 25];

export default function BreaksPage() {
  const { state, execute, loading } = useExecutionEngineContext();
  const [busy, setBusy] = useState(false);

  const activeTile: Tile | null = state.execution.activeTileId
    ? state.tiles.get(state.execution.activeTileId) ?? null
    : null;
  const isOnBreak = state.execution.phaseKind === "break";

  const breakTiles = useMemo(() => {
    return Array.from(state.tiles.values()).filter(
      (t) =>
        t.annotation.semanticRole === "break" ||
        t.objective.targetRestMin !== null ||
        (t.core.title ?? "").toLowerCase().includes("break"),
    );
  }, [state.tiles]);

  const recentBreaks = useMemo(() => {
    return state.timeline
      .filter((it) => it.type === "break" && it.endAt)
      .slice(-12)
      .reverse();
  }, [state.timeline]);

  async function startBreak(min: number) {
    setBusy(true);
    try {
      await execute(
        {
          type: "start_break",
          linked_tile_id: activeTile?.core.id ?? null,
          break_min: min,
          reason: null,
        },
        Actor.human("self"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function endBreak() {
    setBusy(true);
    try {
      await execute(
        {
          type: "end_break",
          tile_id: activeTile?.core.id ?? null,
          ended_at: new Date(),
        },
        Actor.human("self"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">execution · breaks</span>}
        title="Breaks"
        description="The engine treats breaks the same as any other tile — they're a condition combination, not a category. This page makes the break-shaped ones easy to start and review."
        meta={
          <>
            <Pill variant={isOnBreak ? "active" : "default"}>
              <StatusDot status={isOnBreak ? "active" : "ready"} pulse={isOnBreak} size="xs" />
              {isOnBreak ? "On break" : "Not on break"}
            </Pill>
            <Pill variant="default">
              <Coffee className="h-3 w-3" /> {breakTiles.length} break tiles
            </Pill>
            <Pill variant="default">{recentBreaks.length} recent</Pill>
          </>
        }
        actions={
          isOnBreak ? (
            <Button variant="primary" size="md" onClick={endBreak} loading={busy}>
              <Play className="h-3.5 w-3.5" />
              End break
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <Pause className="h-3.5 w-3.5" /> Start a break
          </div>
          <p className="mt-2 text-sm text-ink-3">
            Choose a duration. The engine emits a <code className="font-mono">break_started</code> event
            and a prompt will appear at the end so you can decide what&apos;s next.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BREAK_PRESETS.map((m) => (
              <Button
                key={m}
                variant="secondary"
                size="lg"
                onClick={() => void startBreak(m)}
                loading={busy}
                disabled={isOnBreak}
                className="flex-col"
              >
                <Timer className="h-4 w-4" />
                <span className="font-mono text-lg font-semibold">{m}m</span>
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  {labelFor(m)}
                </span>
              </Button>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-dashed border-border p-2.5 text-[11px] text-ink-3">
            Linked to active tile: <span className="font-mono text-ink-1">{activeTile?.core.title ?? "—"}</span>.
            Change the active tile from the <a href="/dashboard" className="text-accent hover:underline">home page</a>.
          </div>
        </Card>

        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            Break tiles
          </div>
          {breakTiles.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">
              No break-shaped tiles yet. Create one with{" "}
              <code className="font-mono">objectiveMode = &quot;label_only&quot;</code> and
              a <code className="font-mono">targetRestMin</code>.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {breakTiles.map((t) => (
                <li key={t.core.id} className="flex items-center gap-3 py-2">
                  <PauseCircle className="h-4 w-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-1">{t.core.title}</span>
                  <span className="font-mono text-[10px] text-ink-4">
                    {t.objective.targetRestMin ? `${t.objective.targetRestMin}m` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <Timer className="h-3.5 w-3.5" /> Recent break activity
          </div>
          <Button variant="ghost" size="sm">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : recentBreaks.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No breaks logged yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recentBreaks.map((b) => (
              <li
                key={b.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-sm"
              >
                <span className="truncate text-ink-1">{b.title}</span>
                <span className="font-mono text-[10px] text-ink-4">
                  {new Date(b.startAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-mono text-[10px] text-ink-3">
                  {b.durationMin ?? "—"}m
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}

function labelFor(m: number): string {
  if (m <= 5) return "Micro";
  if (m <= 10) return "Short";
  if (m <= 15) return "Standard";
  return "Long";
}
