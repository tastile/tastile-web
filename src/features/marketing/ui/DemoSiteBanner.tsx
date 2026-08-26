"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { AlertTriangle } from "lucide-react";

const X_DM_URL = "https://twitter.com/361do_sleep";
const REPO_URL = "https://github.com/tastile/tastile-web";

export function DemoSiteBanner() {
  const { t } = useTranslation();

  return (
    <output
      data-testid="demo-site-banner"
      className="fixed bottom-0 left-0 right-0 z-[80] h-9 bg-amber-500/15 text-amber-900 backdrop-blur-sm dark:bg-amber-400/10 dark:text-amber-200"
    >
      <div className="layout-shell flex h-full items-center gap-3 text-xs">
        <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
        <p className="flex-1 truncate">
          {t("demoBanner.text")}{" "}
          <a
            href={X_DM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline underline-offset-2 hover:opacity-80"
          >
            {t("demoBanner.xLink")}
          </a>
          <span aria-hidden> · </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {t("demoBanner.repoLink")}
          </a>
        </p>
      </div>
    </output>
  );
}
