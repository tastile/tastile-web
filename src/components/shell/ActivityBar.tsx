"use client";

import { CalendarDays, CheckSquare, Layers, Plus, Repeat, type LucideIcon } from "lucide-react";
import { useShellStore, type SidePanel } from "@/lib/stores/shell-store";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

interface IconDef { panel: SidePanel; label: string; Icon: LucideIcon }

const ICONS: IconDef[] = [
  { panel: "references", label: "References", Icon: CalendarDays },
  { panel: "tasks", label: "Tasks", Icon: CheckSquare },
  { panel: "projects", label: "Projects", Icon: Layers },
  { panel: "schedule", label: "Schedule", Icon: Repeat },
];

export function ActivityBar() {
  const panel = useShellStore((s) => s.panel);
  const setPanel = useShellStore((s) => s.setPanel);
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const { t } = useTranslation();

  return (
    <nav aria-label="Activity bar" className="flex w-12 shrink-0 flex-col items-stretch bg-surface-0">
      <a
        href="/dashboard"
        aria-label="tastile home"
        className="flex h-12 items-center justify-center"
      >
        <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[11px] font-bold text-primary-fg">T</span>
      </a>
      <button
        type="button"
        title={t("nav.new")}
        onClick={openQuickCreate}
        className="flex h-12 items-center justify-center text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      {ICONS.map(({ panel: p, label, Icon }) => {
        const active = panel === p;
        return (
          <button
            key={p}
            type="button"
            aria-label={label}
            aria-current={active ? "true" : undefined}
            onClick={() => setPanel(p)}
            className={cn(
              "relative flex h-12 items-center justify-center text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              active && "text-primary",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
