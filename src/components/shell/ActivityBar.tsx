"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckSquare, Layers, Plus, Repeat, type LucideIcon } from "lucide-react";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

interface IconDef { path: string; label: string; Icon: LucideIcon }

const ICONS: IconDef[] = [
  { path: "/dashboard/references", label: "References", Icon: CalendarDays },
  { path: "/dashboard/tasks", label: "Tasks", Icon: CheckSquare },
  { path: "/dashboard/projects", label: "Projects", Icon: Layers },
  { path: "/dashboard/schedule", label: "Schedule", Icon: Repeat },
];

export function ActivityBar() {
  const pathname = usePathname();
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const { t } = useTranslation();

  return (
    <nav aria-label="Activity bar" className="flex w-12 shrink-0 flex-col items-stretch bg-surface-0">
      <Link
        href="/dashboard"
        aria-label="tastile home"
        className="flex h-12 items-center justify-center"
      >
        <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[11px] font-bold text-primary-fg">T</span>
      </Link>
      <button
        type="button"
        title={t("nav.new")}
        onClick={openQuickCreate}
        className="flex h-12 items-center justify-center text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      {ICONS.map(({ path, label, Icon }) => {
        const active = pathname === path;
        return (
          <Link
            key={path}
            href={path}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-12 items-center justify-center text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              active && "text-primary",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
            <Icon className="h-4 w-4" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
