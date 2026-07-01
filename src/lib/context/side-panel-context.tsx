"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

// ─────────────────────────────────────────────
// Side-panel content store (module-level mutable holder).
//
// Why: a React `useState` for the content forces the entire provider
// sub-tree (including the page tree) to re-render on every change.
// That re-renders the calling page, whose `useSidePanel(<X />)`
// creates a fresh JSX element each time, whose effect re-runs and
// calls `register`, which loops forever ("Maximum update depth
// exceeded"). To avoid that we keep the latest content in a ref +
// version counter and read it through `useSyncExternalStore`. The
// store notifies *only* consumers that subscribe via the hook —
// the page tree does not subscribe and therefore does not re-render
// when the content changes.
// ─────────────────────────────────────────────
let currentContent: ReactNode = null;
let version = 0;
const listeners = new Set<() => void>();

function setContent(node: ReactNode | null) {
  if (currentContent === node) return;
  currentContent = node;
  version += 1;
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// `useSyncExternalStore` requires a stable snapshot getter.
// We use the version counter as the snapshot — any change produces
// a new snapshot and triggers consumers to re-read.
function getSnapshot(): number {
  return version;
}

function getServerSnapshot(): number {
  return 0;
}

// ─────────────────────────────────────────────
// Register context — stable callback the page uses to push content.
// ─────────────────────────────────────────────
type RegisterFn = (node: ReactNode | null) => void;

const SidePanelRegisterContext = createContext<RegisterFn>(() => {});

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function SidePanelProvider({ children }: { children: ReactNode }) {
  // Stable callback — never changes identity.
  const register = useCallback<RegisterFn>(setContent, []);

  return (
    <SidePanelRegisterContext.Provider value={register}>
      {children}
    </SidePanelRegisterContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook — page registers its panel content.
//
// `register` is stable, so the effect that pushes the latest content
// runs only on mount/unmount. We additionally push content updates
// from a layout effect that depends only on `content` — the page
// tree does not subscribe to the content store, so updating it does
// not loop.
// ─────────────────────────────────────────────
export function useSidePanel(content: ReactNode) {
  const register = useContext(SidePanelRegisterContext);
  const lastContentRef = useRef<ReactNode | null>(null);

  // Mount / unmount lifecycle.
  useEffect(() => {
    lastContentRef.current = content;
    register(content);
    return () => {
      register(null);
      lastContentRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, content]);

  // Push content updates without re-running the mount effect.
  // The page tree does not subscribe to the store, so this does not
  // cause an infinite loop.
  useEffect(() => {
    if (lastContentRef.current === content) return;
    lastContentRef.current = content;
    register(content);
  }, [content, register]);
}

// ─────────────────────────────────────────────
// Consumer Hook — layout 側が使う。購読は version のみ。
// ─────────────────────────────────────────────
export function useSidePanelContent(): ReactNode | null {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return currentContent;
}
