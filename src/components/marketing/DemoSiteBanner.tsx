"use client";

import { AlertTriangle } from "lucide-react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const X_DM_URL = "https://twitter.com/361do_sleep";
const REPO_URL = "https://github.com/tastile/tastile-web";

const COPY = {
  ja: {
    text: "このサイトは開発中です。デモとしての提供であり、品質や可用性は保証されません。データは予告無くリセットされる可能性があります。",
    xLink: "X: @361do_sleep",
    repoLink: "ソース: GitHub",
  },
  en: {
    text: "This site is under active development. It is provided as a demo; quality and availability are not guaranteed. Data may be reset without notice.",
    xLink: "X: @361do_sleep",
    repoLink: "Source: GitHub",
  },
} as const;

export function DemoSiteBanner() {
  const locale = useLocaleStore((s) => s.locale);
  const copy = locale === "ja" ? COPY.ja : COPY.en;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="demo-site-banner"
      className="sticky top-0 left-0 right-0 z-[80] h-9 border-b border-amber-500/20 bg-amber-500/15 text-amber-900 backdrop-blur-sm dark:bg-amber-400/10 dark:text-amber-200"
    >
      <div className="layout-shell flex h-full items-center gap-3 text-xs">
        <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <p className="flex-1 truncate">
          {copy.text}{" "}
          <a
            href={X_DM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline underline-offset-2 hover:opacity-80"
          >
            {copy.xLink}
          </a>
          <span aria-hidden> · </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {copy.repoLink}
          </a>
        </p>
      </div>
    </div>
  );
}
