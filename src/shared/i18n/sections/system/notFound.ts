import type { Locale } from "@/shared/stores/locale-store";

export const notFound = {
  en: {
    notFound: {
      title: "Page not found",
      description: "The page you are looking for may have been moved, removed, or the URL is incorrect.",
      backToDashboard: "Back to dashboard",
    },
  },
  ja: {
    notFound: {
      title: "ページが見つかりません",
      description: "お探しのページは移動、削除、または URL が正しくない可能性があります。",
      backToDashboard: "ダッシュボードへ戻る",
    },
  },
  "zh-CN": {
    notFound: {
      title: "页面未找到",
      description: "您查找的页面可能已被移动、删除，或 URL 不正确。",
      backToDashboard: "返回仪表板",
    },
  },
  ko: {
    notFound: {
      title: "페이지를 찾을 수 없습니다",
      description: "찾고 계신 페이지가 이동, 삭제되었거나 URL이 올바르지 않을 수 있습니다.",
      backToDashboard: "대시보드로 돌아가기",
    },
  },
  es: {
    notFound: {
      title: "Página no encontrada",
      description: "La página que buscas puede haber sido movida, eliminada, o la URL es incorrecta.",
      backToDashboard: "Volver al panel",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
