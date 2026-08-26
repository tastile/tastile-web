"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import { CreditCard, Key, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Section = {
  labelKey: "preferences.sidePanel.projectSettings" | "preferences.sidePanel.account" | "preferences.sidePanel.billing";
  items: Array<{
    id: string;
    path: string;
    labelKey:
      | "preferences.sidePanel.general"
      | "preferences.sidePanel.profile"
      | "preferences.sidePanel.accessTokens"
      | "preferences.sidePanel.subscription";
    icon: typeof Settings;
  }>;
};

const SECTIONS: Section[] = [
  {
    labelKey: "preferences.sidePanel.projectSettings",
    items: [
      {
        id: "general",
        path: "/dashboard/preferences/general",
        labelKey: "preferences.sidePanel.general",
        icon: Settings,
      },
    ],
  },
  {
    labelKey: "preferences.sidePanel.account",
    items: [
      {
        id: "profile",
        path: "/dashboard/preferences/account",
        labelKey: "preferences.sidePanel.profile",
        icon: User,
      },
      {
        id: "tokens",
        path: "/dashboard/preferences/account?tab=tokens",
        labelKey: "preferences.sidePanel.accessTokens",
        icon: Key,
      },
    ],
  },
  {
    labelKey: "preferences.sidePanel.billing",
    items: [
      {
        id: "subscription",
        path: "/dashboard/preferences/account?tab=subscription",
        labelKey: "preferences.sidePanel.subscription",
        icon: CreditCard,
      },
    ],
  },
];

export function PreferencesSidePanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  return (
    <div className="flex flex-col gap-6 pt-4 px-3">
      {SECTIONS.map((section) => (
        <div key={section.labelKey} className="flex flex-col gap-1">
          <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-foreground-muted">
            {t(section.labelKey)}
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
                  "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors text-left",
                  isActive
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-foreground-subtle hover:bg-surface-1 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
