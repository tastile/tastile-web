"use client";

import { ArrowRight, Lightbulb, PenLine, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    icon: <PenLine className="w-5 h-5" />,
    ja: {
      title: "やることを書く",
      body: "やりたいことや期限のあることを入力。",
    },
    en: { title: "Add tasks", body: "Enter what you need to do." },
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    ja: { title: "自動で組まれる", body: "Tastileが時間帯まで自動で組む。" },
    en: {
      title: "Auto-scheduled",
      body: "Tastile builds your timeline automatically.",
    },
  },
  {
    icon: <Play className="w-5 h-5" />,
    ja: {
      title: "実行する",
      body: "提示されたタイルを開始。完了にすれば次が届く。",
    },
    en: {
      title: "Execute",
      body: "Start the tile. Next one arrives when done.",
    },
  },
];

export function AnimatedCycle({ lang }: { lang: "ja" | "en" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(index)) {
              setActiveIndex((prev) => Math.max(prev, index));
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: "0px 0px -20% 0px" },
    );

    const items = container.querySelectorAll("[data-index]");
    items.forEach((item) => {
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-4">
      {steps.map((step, i) => {
        const isActive = i <= activeIndex;
        const t = step[lang];
        return (
          <div key={i} className="flex items-center gap-4">
            <div
              data-index={i}
              className="w-48 text-center transition-all duration-500"
              style={{
                opacity: isActive ? 1 : 0.2,
                transform: isActive ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-500 ${
                  isActive ? "bg-foreground text-background" : "bg-surface-2 text-foreground-subtle"
                }`}
              >
                {step.icon}
              </div>
              <p className="mt-4 font-[family-name:var(--font-jp-heading)] text-sm font-semibold text-foreground">
                {t.title}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">{t.body}</p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight
                className="h-5 w-5 flex-none transition-all duration-500"
                style={{
                  opacity: i < activeIndex ? 1 : 0.2,
                }}
              />
            )}
          </div>
        );
      })}
      <ArrowRight
        className="h-5 w-5 flex-none transition-all duration-500"
        style={{
          opacity: activeIndex >= steps.length - 1 ? 1 : 0.2,
        }}
      />
    </div>
  );
}
