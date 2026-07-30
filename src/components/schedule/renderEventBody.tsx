// src/components/schedule/renderEventBody.tsx
"use client";

import type { CalendarEvent } from "@/lib/domain/calendar";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import * as Lucide from "lucide-react";
import type { FC } from "react";

export type EventScope = "day" | "week" | "month" | "agenda";

const SCOPE_TESTID: Record<EventScope, string> = {
  day: "day-event",
  week: "week-event",
  month: "month-event",
  agenda: "agenda-event",
};

export function renderEventBody(event: ScheduleEventData<CalendarEvent>, scope: EventScope) {
  const e = event.payload;
  if (!e) return null;
  const rawIcon = e.icon?.trim();
  const pascalized = rawIcon ? pascalize(rawIcon) : "";
  const lucideRecord = Lucide as unknown as Record<string, FC<{ className?: string }>>;
  const Icon = pascalized && pascalized in lucideRecord ? lucideRecord[pascalized] : null;
  return (
    <div
      data-testid={`${SCOPE_TESTID[scope]}-${e.id}`}
      className="flex items-center gap-1 truncate"
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {/*
        Guard: Icon may be undefined at runtime (e.g. unknown icon name,
        whitespace-only name) even when the type says FC. JSX cannot render
        undefined, so the ternary is necessary.
      */}
      <span className="truncate">{e.title}</span>
      {e.project ? (
        <span
          data-testid="event-project"
          className="rounded bg-surface-2 px-1 text-[9px] uppercase tracking-wider text-foreground-subtle"
        >
          {e.project}
        </span>
      ) : null}
      {e.tags?.length
        ? e.tags.map((t) => (
            <span
              key={t}
              data-testid={`event-tag-${t}`}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))
        : null}
    </div>
  );
}

function pascalize(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}
