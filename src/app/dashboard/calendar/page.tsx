"use client";

import {
  CalendarDays,
  ChevronRight,
  Compass,
  Database,
  Eye,
  ListChecks,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/StatusDot";
import { ENDPOINTS, ENDPOINTS_BY_TAG, type EndpointKey } from "@/lib/api/endpoints";

const VIEWS: Array<{
  key: EndpointKey;
  label: string;
  description: string;
  range: string;
  href: string;
}> = [
  {
    key: "getCalendarDay",
    label: "Day",
    description: "Hour-by-hour map of today's work, breaks, and fixed commitments.",
    range: "24 hours",
    href: "/dashboard/calendar/day",
  },
  {
    key: "getCalendarWeek",
    label: "Week",
    description: "Seven days, grouped by work block density.",
    range: "7 days",
    href: "/dashboard/calendar/week",
  },
  {
    key: "getCalendarMonth",
    label: "Month",
    description: "Month view with work/break/fixed legend.",
    range: "30 days",
    href: "/dashboard/calendar/month",
  },
  {
    key: "getCalendarYear",
    label: "Year",
    description: "Twelve months at a glance, useful for retrospective review.",
    range: "12 months",
    href: "/dashboard/calendar/year",
  },
];

export default function CalendarHubPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">views · calendar</span>}
        title="Calendar"
        description="Four views, all powered by the same Views API. Pick a horizon. The same data, different resolution."
        meta={
          <>
            <Pill variant="accent">
              <Compass className="h-3 w-3" />
              {VIEWS.length} views
            </Pill>
            <Pill variant="default">
              <Database className="h-3 w-3" />
              {ENDPOINTS_BY_TAG.Views.length} view endpoints
            </Pill>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VIEWS.map((v) => {
          const meta = ENDPOINTS[v.key];
          return (
            <Link
              key={v.key}
              href={v.href}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-1">{v.label}</h3>
                    <Pill variant="default">{v.range}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">{v.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-ink-3">
                <span className="rounded bg-surface-2 px-1.5 py-0.5">{meta.method}</span>
                <code className="truncate">{meta.path}</code>
              </div>
            </Link>
          );
        })}
      </section>

      <Card>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
          <Sparkles className="h-3.5 w-3.5" /> Related views
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <RelatedTile
            href="/dashboard/timeline"
            icon={<ListChecks className="h-4 w-4" />}
            title="Timeline"
            description="Today only, vertical scroll. Best for the live view."
            k="getTimelineToday"
          />
          <RelatedTile
            href="/dashboard/api?focus=getActiveTileView"
            icon={<Eye className="h-4 w-4" />}
            title="Active tile"
            description="Just the running tile with all its conditions."
            k="getActiveTileView"
          />
          <RelatedTile
            href="/dashboard/api?focus=getPendingPrompt"
            icon={<Sparkles className="h-4 w-4" />}
            title="Pending prompt"
            description="The one decision the engine needs right now."
            k="getPendingPrompt"
          />
        </div>
      </Card>
    </PageContainer>
  );
}

function RelatedTile({
  href,
  icon,
  title,
  description,
  k,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  k: EndpointKey;
}) {
  const meta = ENDPOINTS[k];
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-md border border-border bg-surface-0 p-3 transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2 group-hover:text-ink-1">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-1">{title}</div>
        <p className="mt-0.5 text-xs text-ink-3">{description}</p>
        <code className="mt-1 inline-block font-mono text-[10px] text-ink-4">
          {meta.method} {meta.path}
        </code>
      </div>
    </Link>
  );
}
