"use client";

import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { FloatingHeader } from "@/components/shell/FloatingHeader";
import { SideToolPanel } from "@/components/shell/SideToolPanel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AuthProvider, useAuth } from "@/lib/context/auth-context";
import { SidePanelProvider, useSidePanelContent } from "@/lib/context/side-panel-context";
import { ExecutionEngineProvider } from "@/lib/hooks/execution-engine-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { ActionIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { PanelLeftDashed } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// QuickTileCreate is a 3000-line client component with many submodules;
// split it out of the layout bundle so the initial dashboard load only
// pays for the dialog when the user actually opens it. Rendered through
// a Zustand store internally — keeping it always-mounted (no `loading`
// placeholder) so the store subscription is wired before open.
const QuickTileCreate = dynamic(
  () => import("@/components/tiles/QuickTileCreate").then((m) => m.QuickTileCreate),
  { ssr: false },
);

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ExecutionEngineProvider>
        <SecurityLockGate>
          <SidePanelProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
          </SidePanelProvider>
        </SecurityLockGate>
      </ExecutionEngineProvider>
    </AuthProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const closeQuickCreate = useQuickCreateStore((s) => s.close);
  const { t } = useTranslation();
  const { session } = useAuth();
  // NOTE: do NOT subscribe to useSidePanelContent() here — that would
  // re-render this layout (and its children, including the page tree)
  // every time the side-panel content changes, which combines with the
  // page's own useSidePanel(...) push to produce a render → effect →
  // setContent → render loop ("Maximum update depth exceeded").
  // SideToolPanel already subscribes internally and re-renders on its
  // own. The mobile floating button below reads its own subscription
  // through a small dedicated component instead.
  const _pathname = usePathname();
  const [mobileSidePanelOpen, { open: openMobileSidePanel, close: closeMobileSidePanel }] =
    useDisclosure(false);
  const [searchOpen, { open: openSearch, close: closeSearch }] = useDisclosure(false);
  const [notificationsOpen, { open: openNotifications, close: closeNotifications }] =
    useDisclosure(false);
  // Bell button lives inside FloatingHeader but the notifications
  // panel is mounted here as a sibling overlay. Without sharing the
  // ref, NotificationsMenu's anchorRef is undefined and the panel's
  // positioning effect bails out (data-state stays "closed" → invisible).
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        openQuickCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSearch, openQuickCreate]);

  useEffect(() => {
    closeQuickCreate();
  }, [closeQuickCreate]);

  return (
    <div className="flex h-dvh flex-col bg-background pb-9">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--surface-3)] focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main
      </a>
      <FloatingHeader
        userName={session?.displayName ?? "Loading..."}
        onOpenSearch={openSearch}
        onOpenNotifications={openNotifications}
        notificationsButtonRef={notificationsButtonRef}
      />

      <div className="flex min-h-0 flex-1 pt-12">
        {/* ActivityBar: Supabase-style collapsible sidebar */}
        <ActivityBar />
        {/* SideToolPanel: renders content registered by each page via useSidePanel() */}
        <SideToolPanel />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto bg-surface-0">
          {/* `h-full` (not `min-h-full`) so children's percentage heights
              resolve against a definite container — without this, the
              Month view's `flex h-full flex-col` root would size to its
              own content and overflow <main>, leaving empty space below
              the table. */}
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* Global overlays */}
      <SearchOverlay open={searchOpen} onClose={closeSearch} />
      <NotificationsMenu
        open={notificationsOpen}
        onOpenChange={(next) => (next ? openNotifications() : closeNotifications())}
        anchorRef={notificationsButtonRef}
      />
      {/* QuickTileCreate: desktop = right slide, mobile = bottom slide-up */}
      <QuickTileCreate />

      {/* Mobile side-panel floating action button (only when below md and content exists) */}
      <MobileSidePanelFab onClick={openMobileSidePanel} />

      {/* Mobile side-panel drawer */}
      <BottomSheet
        open={mobileSidePanelOpen}
        onOpenChange={(next) => (next ? openMobileSidePanel() : closeMobileSidePanel())}
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
    <ActionIcon
      variant="filled"
      size="xl"
      radius="xl"
      aria-label={t("dashboard.sidePanelOpenAria")}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex md:!hidden"
      style={{ boxShadow: "var(--mantine-shadow-lg)" }}
    >
      <PanelLeftDashed size={20} />
    </ActionIcon>
  );
}

function MobileSidePanelContent() {
  return useSidePanelContent();
}
