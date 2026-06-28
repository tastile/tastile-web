"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  // Memoize the context value so consumers don't re-render on every
  // SidePanelProvider render — only when `content` actually changes.
  const value = useMemo(() => ({ content, register }), [content, register]);

  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
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
  // Capture the first-render content; subsequent renders (which would
  // produce a new React element identity from inline JSX) must not re-trigger
  // register, otherwise the provider's setContent would cascade and re-render
  // every consumer of useSidePanelContent.
  const initialContent = useRef(content);
  // Track the latest content so unmount cleanup uses the freshest reference.
  const latestContent = useRef(content);
  useEffect(() => {
    latestContent.current = content;
  });
  useEffect(() => {
    register(initialContent.current);
    return () => register(null);
  }, [register]);
}

// ─────────────────────────────────────────────
// Consumer Hook — layout 側が使う
// ─────────────────────────────────────────────
export function useSidePanelContent() {
  return useContext(SidePanelContext).content;
}
