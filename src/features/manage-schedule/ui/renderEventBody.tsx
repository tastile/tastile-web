// src/components/schedule/renderEventBody.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import { Skeleton } from "@mantine/core";
import * as Lucide from "lucide-react";
import type { FC } from "react";
import { MONTH_LOADING_EVENT_TITLE } from "./eventAdapter";

export type EventScope = "day" | "week" | "month" | "agenda";

const SCOPE_TESTID: Record<EventScope, string> = {
	day: "day-event",
	week: "week-event",
	month: "month-event",
	agenda: "agenda-event",
};

export function renderEventBody(
	event: ScheduleEventData<CalendarEvent>,
	scope: EventScope,
) {
	const e = event.payload;
	if (!e) return null;
	// Loading placeholders are CalendarEvent shells with a sentinel
	// title; render a Mantine Skeleton sized to fill the ScheduleEvent
	// wrapper so the skeleton IS the event card at the same size and
	// position as the real card would be. height/width both "100%" so
	// the Skeleton occupies the full colored card area (the wrapper's
	// padding + rounded corners stay; the Skeleton's gray fills inside
	// them). Using Mantine's height/width props (not Tailwind h-*/w-*)
	// because Skeleton's CSS sets `--skeleton-height` as unlayered CSS
	// and wins over `@layer utilities`.
	if (e.title === MONTH_LOADING_EVENT_TITLE) {
		return (
			<Skeleton
				data-testid={`${SCOPE_TESTID[scope]}-loading`}
				height="100%"
				width="100%"
				radius="xs"
				animate
			/>
		);
	}
	const rawIcon = e.icon?.trim();
	const pascalized = rawIcon ? pascalize(rawIcon) : "";
	const lucideRecord = Lucide as unknown as Record<
		string,
		FC<{ className?: string; "aria-hidden"?: boolean }>
	>;
	const Icon =
		pascalized && pascalized in lucideRecord ? lucideRecord[pascalized] : null;
	return (
		<div
			data-testid={`${SCOPE_TESTID[scope]}-${e.id}`}
			className="flex items-center gap-1 truncate"
		>
			{Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
			{/*
        Guard: Icon may be undefined at runtime (e.g. unknown icon name,
        whitespace-only name) even when the type says FC. JSX cannot render
        undefined, so the ternary is necessary.
      */}
			<span className="truncate">{e.title}</span>
			{e.project ? (
				<span
					data-testid="event-project"
					className="rounded bg-surface-2 px-1 text-caption uppercase tracking-wider text-foreground-subtle"
				>
					{e.project}
				</span>
			) : null}
			{e.tags?.length
				? e.tags.map((t) => (
						<span
							key={t}
							data-testid={`event-tag-${t}`}
							className="size-1.5 rounded-full bg-primary"
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
