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
      empty: "No notifications yet",
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
      empty: "通知はまだありません",
    },
  },
  "zh-CN": {
    notifications: {
      promptPending: "需要处理的操作",
      onBreak: "正在休息",
      running: "运行中",
      accessShareOffer: "共享邀请",
      accessRequest: "访问请求",
      accessUpdated: "访问权限已更新",
      accessOther: "访问通知",
      generic: "通知",
      empty: "暂无通知",
    },
  },
  ko: {
    notifications: {
      promptPending: "확인 필요한 알림",
      onBreak: "휴식 중",
      running: "실행 중",
      accessShareOffer: "공유 요청",
      accessRequest: "접근 요청",
      accessUpdated: "접근 권한 업데이트됨",
      accessOther: "접근 알림",
      generic: "알림",
      empty: "아직 알림이 없습니다",
    },
  },
  es: {
    notifications: {
      promptPending: "Acción requerida",
      onBreak: "En pausa",
      running: "En ejecución",
      accessShareOffer: "Oferta de compartición",
      accessRequest: "Solicitud de acceso",
      accessUpdated: "Acceso actualizado",
      accessOther: "Notificación de acceso",
      generic: "Notificación",
      empty: "Aún no hay notificaciones",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
