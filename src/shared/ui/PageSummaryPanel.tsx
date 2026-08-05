"use client";

import { cn } from "@/shared/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageSummaryItem {
  label: string;
  value: ReactNode;
  href?: string;
}

interface PageSummarySection {
  heading?: string;
  items: PageSummaryItem[];
}

export interface PageSummaryPanelProps {
  title: string;
  description?: string;
  sections: PageSummarySection[];
  footer?: ReactNode;
}

export function PageSummaryPanel({ title, description, sections, footer }: PageSummaryPanelProps) {
  return (
    <div className="flex flex-col gap-6 pt-4 px-3">
      <header className="flex flex-col gap-1 px-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-xs leading-relaxed text-foreground-muted">{description}</p>
        ) : null}
      </header>

      {sections.map((section, sectionIdx) => (
        <section key={section.heading ?? `section-${sectionIdx}`} className="flex flex-col gap-1">
          {section.heading ? (
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
              {section.heading}
            </p>
          ) : null}
          <ul className="flex flex-col">
            {section.items.map((item, itemIdx) => {
              const content = (
                <>
                  <span className="text-[11px] uppercase tracking-wider text-foreground-muted">
                    {item.label}
                  </span>
                  <span className="font-mono text-xs text-foreground">{item.value}</span>
                </>
              );
              return (
                <li
                  key={`${item.label}-${itemIdx}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
                    item.href && "hover:bg-surface-2 transition-colors",
                  )}
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex w-full items-center justify-between gap-2"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {footer ? <div className="border-t border-border pt-3">{footer}</div> : null}
    </div>
  );
}
