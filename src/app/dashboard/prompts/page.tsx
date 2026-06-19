"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Hourglass,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Empty";
import { Pill, StatusDot } from "@/components/ui/StatusDot";
import { Actor } from "@/lib/domain/actor";
import { TileId } from "@/lib/domain/ids";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { cn } from "@/lib/utils/cn";

export default function PromptsPage() {
  const { state, execute, loading } = useExecutionEngineContext();
  const [responding, setResponding] = useState(false);

  const pending = state.execution.pendingPrompt;

  async function respond(action: string) {
    if (!pending) return;
    setResponding(true);
    try {
      await execute(
        {
          type: "clear_prompt",
          prompt_id: pending.promptId,
          reason: action,
        },
        Actor.human("self"),
      );
    } finally {
      setResponding(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">execution · prompts</span>}
        title="Prompts"
        description="Decisions the engine needs a human or agent to make. They appear here as soon as they're emitted, and disappear the moment they're answered."
        meta={
          <>
            <Pill variant={pending ? "warn" : "default"}>
              <StatusDot
                status={pending ? "warn" : "ready"}
                pulse={!!pending}
                size="xs"
              />
              {pending ? "1 pending" : "0 pending"}
            </Pill>
            <Pill variant="default">Critical · Elevated · Soft</Pill>
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.dispatchEvent(new CustomEvent("tastile:open-command"))}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Resolve via command
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Current
          </div>
          {pending ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                    pending.severity === "critical"
                      ? "bg-status-danger-soft text-status-danger"
                      : pending.severity === "elevated"
                        ? "bg-status-warn-soft text-status-warn"
                        : "bg-surface-2 text-ink-2",
                  )}
                >
                  {pending.severity === "critical" ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-ink-1">
                      {pending.title ?? humanize(pending.kind)}
                    </h2>
                    <Pill variant={severityVariant(pending.severity)}>{pending.severity}</Pill>
                    <Pill variant="default">{pending.kind}</Pill>
                  </div>
                  {pending.body ? (
                    <p className="mt-1.5 text-sm text-ink-2">{pending.body}</p>
                  ) : null}
                  {pending.why ? (
                    <p className="mt-1 text-xs text-ink-3">Why: {pending.why}</p>
                  ) : null}
                </div>
              </div>

              {pending.reasons.length > 0 ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                    Reasons
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {pending.reasons.map((r) => (
                      <li
                        key={r}
                        className="flex items-start gap-2 rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs text-ink-2"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {pending.actions.map((a) => (
                  <Button
                    key={a}
                    variant={primaryAction(a) ? "primary" : "secondary"}
                    size="md"
                    onClick={() => void respond(a)}
                    loading={responding}
                    disabled={responding}
                  >
                    {primaryAction(a) ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {humanize(a)}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Env label="Prompt ID" value={pending.promptId} mono />
                <Env label="Tile" value={pending.tileId ? String(pending.tileId) : "—"} mono />
                <Env label="Scheduled" value={pending.scheduledAt.toLocaleString()} mono />
                <Env
                  label="Suggested"
                  value={pending.suggestedMinutes ? `${pending.suggestedMinutes}m` : "—"}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={<Sparkles className="h-6 w-6" />}
                title="No pending prompts"
                description="The engine is autonomous right now. New prompts will land here as soon as the engine emits them."
              />
            </div>
          )}
        </Card>

        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            Prompt anatomy
          </div>
          <p className="mt-2 text-xs text-ink-3">
            A prompt is a fact the engine could not resolve on its own. It carries the
            request, the suggested action, and the reasons — never the result.
          </p>
          <dl className="mt-4 space-y-2 text-xs">
            <Field label="prompt_id" value="unique per emission" />
            <Field label="kind" value="start_tile · end_tile · end_break" />
            <Field label="severity" value="soft → critical" />
            <Field label="actions" value="what the actor can do" />
            <Field label="expires_at" value="optional · auto dismiss" />
          </dl>
          <div className="mt-4 rounded-md border border-dashed border-border p-2.5 text-[11px] text-ink-3">
            API surface: <code className="font-mono">GET /prompts/current</code>,{" "}
            <code className="font-mono">POST /commands/prompt/respond-startup-recovery</code>,{" "}
            <code className="font-mono">POST /commands/prompt/request</code>.
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
          <Hourglass className="h-3.5 w-3.5" />
          History
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center text-sm text-ink-4">
          <Clock className="h-5 w-5" />
          Prompt history is part of the append-only event log.
          <LinkOut href="/dashboard/events">Open events log →</LinkOut>
        </div>
      </Card>
    </PageContainer>
  );
}

function severityVariant(s: string): "warn" | "danger" | "default" {
  if (s === "critical") return "danger";
  if (s === "elevated") return "warn";
  return "default";
}

function primaryAction(a: string): boolean {
  return a.startsWith("confirm") || a.startsWith("complete") || a.startsWith("start");
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Env({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-4">{label}</div>
      <div className={cn("mt-0.5 truncate text-ink-1", mono && "font-mono")} title={value}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5 last:border-0 last:pb-0">
      <span className="text-ink-3">{label}</span>
      <span className="font-mono text-ink-1">{value}</span>
    </div>
  );
}

function LinkOut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-accent hover:underline">
      {children}
    </a>
  );
}
