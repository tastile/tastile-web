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
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
