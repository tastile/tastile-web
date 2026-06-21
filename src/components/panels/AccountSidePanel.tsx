"use client";

import { cn } from "@/lib/utils/cn";
import type { TabId } from "@/app/dashboard/account/page";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "subscription", label: "Subscription" },
  { id: "statistics", label: "Statistics" },
  { id: "usage", label: "Usage" },
  { id: "tokens", label: "Tokens" },
];

export function AccountSidePanel({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex flex-col gap-1 pt-4 px-3">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        Account Settings
      </p>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex h-8 items-center rounded-md px-2.5 text-sm transition-colors text-left",
            activeTab === tab.id
              ? "bg-surface-2 font-medium text-foreground"
              : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
          )}
          aria-pressed={activeTab === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
