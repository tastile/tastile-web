import type { Locale } from "@/shared/stores/locale-store";

export const common = {
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      loading: "Loading",
      confirm: "Confirm",
      back: "Back",
      unexpectedError: "An unexpected error occurred.",
    },
  },
  ja: {
    common: {
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      edit: "編集",
      close: "閉じる",
      loading: "読み込み中",
      confirm: "確認",
      back: "戻る",
      unexpectedError: "予期しないエラーが発生しました。",
    },
  },
  "zh-CN": {
    common: {
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      close: "关闭",
      loading: "加载中",
      confirm: "确认",
      back: "返回",
      unexpectedError: "发生了意外错误。",
    },
  },
  ko: {
    common: {
      save: "저장",
      cancel: "취소",
      delete: "삭제",
      edit: "편집",
      close: "닫기",
      loading: "로드 중",
      confirm: "확인",
      back: "뒤로",
      unexpectedError: "예기치 못한 오류가 발생했습니다.",
    },
  },
  es: {
    common: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      close: "Cerrar",
      loading: "Cargando",
      confirm: "Confirmar",
      back: "Atrás",
      unexpectedError: "Se produjo un error inesperado.",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
