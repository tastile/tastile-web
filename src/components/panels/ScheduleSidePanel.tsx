"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";

const SCHEDULE_VIEWS = [
  { id: "recurring", label: "Recurring Tiles" },
  { id: "upcoming", label: "Upcoming Deadlines" },
];

export function ScheduleSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentView = searchParams.get("view") ?? "recurring";

  function handleSelect(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", id);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="px-4 pt-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Schedule Views
        </span>
      </div>

      <div className="px-2">
        <div className="flex flex-col space-y-0.5">
          {SCHEDULE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                currentView === v.id
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
