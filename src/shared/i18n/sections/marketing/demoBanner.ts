import type { Locale } from "@/shared/stores/locale-store";

export const demoBanner = {
  en: {
    demoBanner: {
      text:
        "This site is under active development. It is provided as a demo; quality and availability are not guaranteed. Data may be reset without notice.",
      xLink: "X: @361do_sleep",
      repoLink: "Source: GitHub",
    },
  },
  ja: {
    demoBanner: {
      text:
        "このサイトは開発中です。デモとしての提供であり、品質や可用性は保証されません。データは予告無くリセットされる可能性があります。",
      xLink: "X: @361do_sleep",
      repoLink: "ソース: GitHub",
    },
  },
  "zh-CN": {
    demoBanner: {
      text:
        "本站正在积极开发中。作为演示提供，不保证质量和可用性。数据可能会在未通知的情况下重置。",
      xLink: "X: @361do_sleep",
      repoLink: "源代码: GitHub",
    },
  },
  ko: {
    demoBanner: {
      text:
        "이 사이트는 활발히 개발 중입니다. 데모로 제공되며 품질과 가용성은 보장되지 않습니다. 데이터는 예고 없이 재설정될 수 있습니다.",
      xLink: "X: @361do_sleep",
      repoLink: "소스: GitHub",
    },
  },
  es: {
    demoBanner: {
      text:
        "Este sitio está en desarrollo activo. Se proporciona como demo; la calidad y la disponibilidad no están garantizadas. Los datos pueden restablecerse sin previo aviso.",
      xLink: "X: @361do_sleep",
      repoLink: "Fuente: GitHub",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
