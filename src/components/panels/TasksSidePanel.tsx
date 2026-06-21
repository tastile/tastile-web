"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";

const BUCKETS = ["All", "Overdue", "Today", "This Week", "Later", "No date", "Closed"];

export function TasksSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const search = searchParams.get("q") ?? "";
  const currentBucket = searchParams.get("bucket") ?? "All";

  function handleSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function handleBucket(b: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (b === "All") params.delete("bucket");
    else params.set("bucket", b);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="px-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Search
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface-1 pl-8 pr-3 text-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="px-2">
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Time
        </p>
        <div className="flex flex-col space-y-0.5">
          {BUCKETS.map((b) => (
            <button
              key={b}
              onClick={() => handleBucket(b)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                currentBucket === b
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
