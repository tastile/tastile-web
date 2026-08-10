import type { Locale } from "@/shared/stores/locale-store";

export const auth = {
  en: {
    auth: {
      mfaSetup: {
        title: "Two-factor authentication setup",
        guidePrefix: "Enable TOTP for the account",
        guideSuffix: " using an authenticator app (Google Authenticator, 1Password, Authy, etc.).",
        step1: "Open your authenticator app.",
        step2:
          "Register the secret below as a Base32 string, or paste the otpauth URL into your app.",
        step3: "Enter the 6-digit code and press Verify.",
        secretLabel: "Secret (Base32)",
        otpauthLabel: "otpauth URL:",
        codeLabel: "6-digit code",
        verify: "Verify",
        codeMismatch: "Code is incorrect",
        errorPrefix: "Error:",
        retrySignin: "Retry sign-in",
      },
    },
  },
  ja: {
    auth: {
      mfaSetup: {
        title: "2 段階認証のセットアップ",
        guidePrefix: "",
        guideSuffix:
          "のアカウントで認証アプリ (Google Authenticator、1Password、Authy など) による TOTP 認証を有効化します。",
        step1: "認証アプリを開きます。",
        step2: "次のシークレットを Base32 文字列として登録するか、otpauth URL を貼り付けます。",
        step3: "6 桁コードを入力して「検証」を押します。",
        secretLabel: "Secret (Base32)",
        otpauthLabel: "otpauth URL:",
        codeLabel: "6 桁コード",
        verify: "検証",
        codeMismatch: "コードが違います",
        errorPrefix: "エラー:",
        retrySignin: "サインインをやり直す",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
