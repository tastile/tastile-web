import type { Locale } from "@/shared/stores/locale-store";

export const header = {
  en: {
    header: {
      active: "Active",
      menu: "Menu",
      notifications: "Notifications",
      sync: {
        in_progress: "sync in progress",
        error: "sync error",
        delta: "sync",
        idle: "sync idle",
      },
    },
  },
  ja: {
    header: {
      active: "実行中",
      menu: "メニュー",
      notifications: "通知",
      sync: {
        in_progress: "同期中",
        error: "同期エラー",
        delta: "同期",
        idle: "同期待機",
      },
    },
  },
  "zh-CN": {
    header: {
      active: "执行中",
      menu: "菜单",
      notifications: "通知",
      sync: {
        in_progress: "同步中",
        error: "同步错误",
        delta: "同步",
        idle: "同步空闲",
      },
    },
  },
  ko: {
    header: {
      active: "실행 중",
      menu: "메뉴",
      notifications: "알림",
      sync: {
        in_progress: "동기화 중",
        error: "동기화 오류",
        delta: "동기화",
        idle: "동기화 대기",
      },
    },
  },
  es: {
    header: {
      active: "Activo",
      menu: "Menú",
      notifications: "Notificaciones",
      sync: {
        in_progress: "sincronizando",
        error: "error de sincronización",
        delta: "sincronizar",
        idle: "sincronización inactiva",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
