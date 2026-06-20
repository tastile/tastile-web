"use client";

import { useEffect, useState } from "react";
import { FloatingHeader } from "@/components/shell/FloatingHeader";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { SideBar } from "@/components/shell/SideBar";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { TileEditPanel } from "@/components/tile/TileEditPanel";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import { ExecutionEngineProvider } from "@/lib/hooks/execution-engine-context";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ExecutionEngineProvider>
      <SecurityLockGate>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </SecurityLockGate>
    </ExecutionEngineProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        openQuickCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openQuickCreate]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <FloatingHeader
        userName="Operator"
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <div className="flex min-h-0 flex-1 pt-12">
        <ActivityBar />
        <SideBar />
        <main className="min-w-0 flex-1 overflow-hidden bg-surface-0">
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* Global overlays — controlled by their respective stores */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsDropdown open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <TileEditPanel />
      <QuickTileCreate />
    </div>
  );
}
