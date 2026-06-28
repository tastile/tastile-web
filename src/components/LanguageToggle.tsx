"use client";
import { useRouter, usePathname } from "next/navigation";
import { useLocaleStore } from "@/lib/stores/locale-store";

export function LanguageToggle() {
  const { locale, setLocale } = useLocaleStore();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const next = locale === "ja" ? "en" : "ja";
    setLocale(next);
    const params = new URLSearchParams(window.location.search);
    params.set("lang", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground transition-colors"
      title={locale === "ja" ? "Switch to English" : "日本語に切替"}
    >
      {locale === "ja" ? "EN" : "JA"}
    </button>
  );
}
