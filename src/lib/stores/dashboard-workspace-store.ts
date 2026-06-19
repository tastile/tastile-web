import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TileListGroupingMode, TimelineScale } from "@/lib/core/dashboard-workspace";

export type TilesWorkspaceTab = "list" | "timeline" | "changes";
export type TilesListViewMode = "compact" | "comfortable" | "detailed";

interface DashboardWorkspaceStore {
  timelineScale: TimelineScale;
  customStartIso: string | null;
  customEndIso: string | null;
  activeTilesTab: TilesWorkspaceTab;
  listGroupingMode: TileListGroupingMode;
  listViewMode: TilesListViewMode;
  collapsedGroupIds: string[];
  setTimelineScale: (scale: TimelineScale) => void;
  setCustomRange: (startIso: string | null, endIso: string | null) => void;
  setActiveTilesTab: (tab: TilesWorkspaceTab) => void;
  setListGroupingMode: (mode: TileListGroupingMode) => void;
  setListViewMode: (mode: TilesListViewMode) => void;
  toggleCollapsedGroup: (groupId: string) => void;
}

export const useDashboardWorkspaceStore = create<DashboardWorkspaceStore>()(
  persist(
    (set) => ({
      timelineScale: "day",
      customStartIso: null,
      customEndIso: null,
      activeTilesTab: "list",
      listGroupingMode: "state",
      listViewMode: "comfortable",
      collapsedGroupIds: [],
      setTimelineScale: (timelineScale) => set({ timelineScale }),
      setCustomRange: (customStartIso, customEndIso) => set({ customStartIso, customEndIso }),
      setActiveTilesTab: (activeTilesTab) => set({ activeTilesTab }),
      setListGroupingMode: (listGroupingMode) => set({ listGroupingMode }),
      setListViewMode: (listViewMode) => set({ listViewMode }),
      toggleCollapsedGroup: (groupId) =>
        set((state) => ({
          collapsedGroupIds: state.collapsedGroupIds.includes(groupId)
            ? state.collapsedGroupIds.filter((id) => id !== groupId)
            : [...state.collapsedGroupIds, groupId],
        })),
    }),
    {
      name: "dashboard-workspace",
    },
  ),
);
