"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { Button } from "@mantine/core";
import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeftTabsProps {
  pinnedOpen: boolean;
}

export function LeftTabs({ pinnedOpen }: LeftTabsProps) {
  const pathname = usePathname();
  const { open: openQuickCreate } = useQuickCreateStore();
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "group flex flex-col gap-2 rounded-xl bg-surface-1 p-2 transition-[width] duration-200",
        pinnedOpen ? "w-44" : "w-14 hover:w-44",
      )}
    >
      {/* New Tile Button - Top */}
      <Button
        type="button"
        onClick={openQuickCreate}
        className="relative flex h-11 w-full items-center overflow-hidden rounded-md bg-primary text-primary-fg transition-colors hover:bg-primary-hover"
        title={t("nav.new")}
      >
        <div className="flex w-10 shrink-0 items-center justify-center">
          <Plus className="size-5" />
        </div>
        <span
          className={cn(
            "whitespace-nowrap text-sm font-medium transition-opacity",
            pinnedOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {t("nav.new")}
        </span>
      </Button>

      {/* Navigation Tabs */}
      <nav className="flex flex-1 flex-col gap-2">
        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings - Bottom */}
        <TabButton
          icon={<Settings className="size-5" />}
          label={t("nav.settings")}
          href="/dashboard/preferences"
          active={pathname?.startsWith("/dashboard/preferences")}
          expanded={pinnedOpen}
        />
      </nav>
    </aside>
  );
}

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
  expanded: boolean;
}

function TabButton({ icon, label, href, active, expanded }: TabButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-11 items-center overflow-hidden rounded-md transition-all",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground-muted hover:bg-surface-1 hover:text-foreground",
      )}
    >
      <div className="flex w-10 shrink-0 items-center justify-center">{icon}</div>
      <span
        className={cn(
          "whitespace-nowrap text-sm font-medium transition-opacity",
          expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
