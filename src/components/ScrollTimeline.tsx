"use client";

import { useRef, ReactNode } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

interface ScrollTimelineProps {
  children: ReactNode;
  /** Extra scroll height as multiplier of viewport height */
  scrollHeight?: number;
  className?: string;
  /** Render function that receives progress 0-1 */
  render: (progress: number) => ReactNode;
}

export function ScrollTimeline({ scrollHeight = 2, className = "", render }: ScrollTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(containerRef);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ minHeight: `${scrollHeight * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {render(progress)}
      </div>
    </div>
  );
}
