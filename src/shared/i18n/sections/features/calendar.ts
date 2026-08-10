import type { Locale } from "@/shared/stores/locale-store";

export const calendar = {
  en: {
    panels: {
      calendar: {
        scale: "Scale",
        day: "Day",
        week: "Week",
        month: "Month",
        custom: "Custom",
        projects: "Projects",
        loadingProjects: "Loading projects…",
      },
    },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  ja: {
    panels: {
      calendar: {
        scale: "表示スケール",
        day: "日",
        week: "週",
        month: "月",
        custom: "カスタム",
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
      },
    },
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  "zh-CN": {
    panels: {
      calendar: {
        scale: "视图尺度",
        day: "日",
        week: "周",
        month: "月",
        custom: "自定义",
        projects: "项目",
        loadingProjects: "正在加载项目…",
      },
    },
    weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  },
  ko: {
    panels: {
      calendar: {
        scale: "보기 단위",
        day: "일",
        week: "주",
        month: "월",
        custom: "사용자 지정",
        projects: "프로젝트",
        loadingProjects: "프로젝트 불러오는 중…",
      },
    },
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
    months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  },
  es: {
    panels: {
      calendar: {
        scale: "Escala",
        day: "Día",
        week: "Semana",
        month: "Mes",
        custom: "Personalizado",
        projects: "Proyectos",
        loadingProjects: "Cargando proyectos…",
      },
    },
    weekdays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  },
} satisfies Record<Locale, Record<string, unknown>>;
