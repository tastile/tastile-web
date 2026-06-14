"use client";

import { useEffect, useState } from "react";

export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const scrollHeight = el.scrollHeight - window.innerHeight;

      if (scrollHeight <= 0) {
        setProgress(0);
        return;
      }

      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / scrollHeight));
      setProgress(p);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ref]);

  return progress;
}
