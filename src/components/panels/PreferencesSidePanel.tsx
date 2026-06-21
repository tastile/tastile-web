"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { id: "general", path: "/dashboard/preferences/general", label: "General" },
  { id: "profile", path: "/dashboard/preferences/account", label: "Profile" },
  { id: "subscription", path: "/dashboard/preferences/account?tab=subscription", label: "Subscription" },
  { id: "statistics", path: "/dashboard/preferences/account?tab=statistics", label: "Statistics" },
  { id: "usage", path: "/dashboard/preferences/account?tab=usage", label: "Usage" },
  { id: "tokens", path: "/dashboard/preferences/account?tab=tokens", label: "Tokens" },
];

export function PreferencesSidePanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  return (
    <div className="flex flex-col gap-1 pt-4 px-3">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        Preferences
      </p>
      {TABS.map((tab) => {
        // query param "?tab=" があるかどうかを含めて判定
        const isPathMatch = pathname === tab.path.split("?")[0];
        const tabParam = tab.path.includes("?tab=") ? tab.path.split("?tab=")[1] : null;
        
        let isActive = false;
        if (tab.id === "profile") {
          isActive = isPathMatch && !currentTab; // profileはtabパラメータなし
        } else if (tabParam) {
          isActive = isPathMatch && currentTab === tabParam;
        } else {
          isActive = isPathMatch; // general
        }
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={cn(
              "flex h-8 items-center rounded-md px-2.5 text-sm transition-colors text-left",
              isActive
                ? "bg-surface-2 font-medium text-foreground"
                : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
