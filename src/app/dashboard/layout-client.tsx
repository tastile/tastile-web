"use client";

import { useEffect, useState } from "react";
import { FloatingHeader } from "@/components/shell/FloatingHeader";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { SideToolPanel } from "@/components/shell/SideToolPanel";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { TileEditPanel } from "@/components/tile/TileEditPanel";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import { ExecutionEngineProvider } from "@/lib/hooks/execution-engine-context";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { SidePanelProvider } from "@/lib/context/side-panel-context";

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ExecutionEngineProvider>
      <SecurityLockGate>
        <SidePanelProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </SidePanelProvider>
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
        {/* ActivityBar: Supabase風の開閉サイドバー */}
        <ActivityBar />
        {/* SideToolPanel: 各ページが useSidePanel() で登録したコンテンツを表示 */}
        <SideToolPanel />
        <main className="min-w-0 flex-1 overflow-hidden bg-surface-0">
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* グローバルオーバーレイ */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsDropdown open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <TileEditPanel />
      {/* QuickTileCreate: デスクトップ=右スライド / モバイル=下スライドアップ */}
      <QuickTileCreate />
    </div>
  );
}
