import type { Locale } from "@/shared/stores/locale-store";

export const notifications = {
  en: {
    notifications: {
      promptPending: "Action required",
      onBreak: "On break",
      running: "Running",
      accessShareOffer: "Share offer",
      accessRequest: "Access request",
      accessUpdated: "Access updated",
      accessOther: "Access notification",
      generic: "Notification",
    },
  },
  ja: {
    notifications: {
      promptPending: "確認が必要な通知があります",
      onBreak: "休憩フェーズが実行中です",
      running: "実行中",
      accessShareOffer: "共有オファーがあります",
      accessRequest: "アクセスリクエストがあります",
      accessUpdated: "アクセス権が更新されました",
      accessOther: "アクセス通知があります",
      generic: "通知があります",
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
