"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const SECTIONS = [
  {
    label: "Project Settings",
    items: [
      { id: "general", path: "/dashboard/preferences/general", label: "General" },
      { id: "statistics", path: "/dashboard/preferences/account?tab=statistics", label: "Statistics" },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "profile", path: "/dashboard/preferences/account", label: "Profile" },
      { id: "tokens", path: "/dashboard/preferences/account?tab=tokens", label: "Access Tokens" },
    ],
  },
  {
    label: "Billing",
    items: [
      { id: "subscription", path: "/dashboard/preferences/account?tab=subscription", label: "Subscription" },
      { id: "usage", path: "/dashboard/preferences/account?tab=usage", label: "Usage" },
    ],
  },
];

export function PreferencesSidePanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  return (
    <div className="flex flex-col gap-6 pt-4 px-3">
      {SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            {section.label}
          </p>
          {section.items.map((tab) => {
            const isPathMatch = pathname === tab.path.split("?")[0];
            const tabParam = tab.path.includes("?tab=") ? tab.path.split("?tab=")[1] : null;
            
            let isActive = false;
            if (tab.id === "profile") {
              isActive = isPathMatch && !currentTab;
            } else if (tabParam) {
              isActive = isPathMatch && currentTab === tabParam;
            } else {
              isActive = isPathMatch;
            }
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={cn(
                  "flex h-8 items-center rounded-md px-2 text-sm transition-colors text-left",
                  isActive
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-foreground-subtle hover:bg-surface-1 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
