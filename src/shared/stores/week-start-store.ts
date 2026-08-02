"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WeekStartDay = "sunday" | "monday";

interface WeekStartState {
  weekStart: WeekStartDay;
  setWeekStart: (day: WeekStartDay) => void;
}

export const useWeekStartStore = create<WeekStartState>()(
  persist(
    (set) => ({
      weekStart: "sunday",
      setWeekStart: (weekStart) => set({ weekStart }),
    }),
    {
      name: "tastile-week-start",
      partialize: (s) => ({ weekStart: s.weekStart }),
    },
  ),
);

/** Returns the firstDayOfWeek value expected by Mantine Schedule components. */
export function getFirstDayOfWeek(pref: WeekStartDay): 0 | 1 {
  return pref === "monday" ? 1 : 0;
}
