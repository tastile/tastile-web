"use client";

import { type ReactNode, useRef } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

interface ScrollSectionProps {
  children: ReactNode;
  /** How many viewports of scroll space this section consumes */
  scrollHeight?: number;
  className?: string;
  bgClassName?: string;
}

/**
 * A section that pins its content and exposes scroll progress.
 * Use useScrollProgress inside children to animate based on scroll position.
 */
export function ScrollSection({
  children,
  scrollHeight = 2,
  className = "",
  bgClassName = "",
}: ScrollSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ minHeight: `${scrollHeight * 100}vh` }}
    >
      <div className={`sticky top-0 h-screen overflow-hidden flex items-center ${bgClassName}`}>
        {typeof children === "function"
          ? (children as (p: number) => ReactNode)(progress)
          : children}
      </div>
    </div>
  );
}
