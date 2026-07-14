"use client";

import { PanelLeftDashed } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { FloatingHeader } from "@/components/shell/FloatingHeader";
import { SideToolPanel } from "@/components/shell/SideToolPanel";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SidePanelProvider, useSidePanelContent } from "@/lib/context/side-panel-context";
import { ExecutionEngineProvider } from "@/lib/hooks/execution-engine-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";

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
  const closeQuickCreate = useQuickCreateStore((s) => s.close);
  const { t } = useTranslation();
  // NOTE: do NOT subscribe to useSidePanelContent() here — that would
  // re-render this layout (and its children, including the page tree)
  // every time the side-panel content changes, which combines with the
  // page's own useSidePanel(...) push to produce a render → effect →
  // setContent → render loop ("Maximum update depth exceeded").
  // SideToolPanel already subscribes internally and re-renders on its
  // own. The mobile floating button below reads its own subscription
  // through a small dedicated component instead.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future use
  const _pathname = usePathname();
  const [mobileSidePanelOpen, setMobileSidePanelOpen] = useState(false);
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

  useEffect(() => {
    closeQuickCreate();
  }, [closeQuickCreate]);

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
        <main className="min-w-0 flex-1 overflow-y-auto bg-surface-0">
          {/* `h-full` (not `min-h-full`) so children's percentage heights
              resolve against a definite container — without this, the
              Month view's `flex h-full flex-col` root would size to its
              own content and overflow <main>, leaving empty space below
              the table. */}
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* グローバルオーバーレイ */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsMenu open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      {/* QuickTileCreate: デスクトップ=右スライド / モバイル=下スライドアップ */}
      <QuickTileCreate />

      {/* モバイル用サイドパネルフローティングボタン (md未満かつコンテンツが存在する場合のみ) */}
      <MobileSidePanelFab onClick={() => setMobileSidePanelOpen(true)} />

      {/* モバイル用サイドパネルドロワー */}
      <BottomSheet
        open={mobileSidePanelOpen}
        onOpenChange={setMobileSidePanelOpen}
        title={t("dashboard.sidePanelDetailsTitle")}
      >
        <div className="py-2">
          <MobileSidePanelContent />
        </div>
      </BottomSheet>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Isolated subscribers so the parent layout does NOT re-render on
// every side-panel content change. The page pushes new content via
// useSidePanel(); only these leaf components re-render in response.
// ────────────────────────────────────────────────────────────────────
function MobileSidePanelFab({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const hasContent = useSidePanelContent() != null;
  if (!hasContent) return null;
  return (
    <button
      type="button"
      aria-label={t("dashboard.sidePanelOpenAria")}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg hover:bg-primary-hover transition-transform active:scale-95 md:hidden animate-in fade-in zoom-in duration-200"
    >
      <PanelLeftDashed className="h-5 w-5" />
    </button>
  );
}

function MobileSidePanelContent() {
  return useSidePanelContent();
}
