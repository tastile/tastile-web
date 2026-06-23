"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface SidePanelContextValue {
  content: ReactNode | null;
  register: (node: ReactNode | null) => void;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const SidePanelContext = createContext<SidePanelContextValue>({
  content: null,
  register: () => {},
});

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const register = useCallback((node: ReactNode | null) => setContent(node), []);

  return (
    <SidePanelContext.Provider value={{ content, register }}>{children}</SidePanelContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook — ページ側が useEffect で登録する
// ─────────────────────────────────────────────
/**
 * サイドパネルにコンテンツを登録する。
 * ページのマウント時に登録、アンマウント時に自動クリア。
 *
 * @example
 * useSidePanel(<TimelineSidePanel />);
 */
export function useSidePanel(content: ReactNode) {
  const { register } = useContext(SidePanelContext);

  useEffect(() => {
    register(content);
    return () => register(null);
  }, [register, content]);
}

// ─────────────────────────────────────────────
// Consumer Hook — layout 側が使う
// ─────────────────────────────────────────────
export function useSidePanelContent() {
  return useContext(SidePanelContext).content;
}
