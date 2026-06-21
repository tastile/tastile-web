"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

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
    <SidePanelContext.Provider value={{ content, register }}>
      {children}
    </SidePanelContext.Provider>
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
    // content は安定した JSX なので deps は register のみで十分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register]);
}

// ─────────────────────────────────────────────
// Consumer Hook — layout 側が使う
// ─────────────────────────────────────────────
export function useSidePanelContent() {
  return useContext(SidePanelContext).content;
}
