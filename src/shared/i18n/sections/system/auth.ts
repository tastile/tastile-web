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
  "zh-CN": {
    auth: {
      mfaSetup: {
        title: "双重认证设置",
        guidePrefix: "为此账户启用 TOTP",
        guideSuffix:
          "，使用身份验证器应用（Google Authenticator、1Password、Authy 等）。",
        step1: "打开身份验证器应用。",
        step2:
          "将下面的密钥作为 Base32 字符串注册，或将 otpauth URL 粘贴到你的应用中。",
        step3: "输入 6 位验证码后点击验证。",
        secretLabel: "密钥（Base32）",
        otpauthLabel: "otpauth URL：",
        codeLabel: "6 位验证码",
        verify: "验证",
        codeMismatch: "验证码不正确",
        errorPrefix: "错误：",
        retrySignin: "重新登录",
      },
    },
  },
  ko: {
    auth: {
      mfaSetup: {
        title: "2단계 인증 설정",
        guidePrefix: "계정에 대해 TOTP를 활성화합니다",
        guideSuffix:
          " 인증 앱(Google Authenticator, 1Password, Authy 등)을 사용하세요.",
        step1: "인증 앱을 엽니다.",
        step2:
          "아래 비밀 키를 Base32 문자열로 등록하거나 otpauth URL을 앱에 붙여넣으세요.",
        step3: "6자리 코드를 입력하고 확인을 누릅니다.",
        secretLabel: "비밀 키 (Base32)",
        otpauthLabel: "otpauth URL:",
        codeLabel: "6자리 코드",
        verify: "확인",
        codeMismatch: "코드가 올바르지 않습니다",
        errorPrefix: "오류:",
        retrySignin: "다시 로그인",
      },
    },
  },
  es: {
    auth: {
      mfaSetup: {
        title: "Configuración de autenticación de doble factor",
        guidePrefix: "Habilita TOTP para la cuenta",
        guideSuffix:
          " usando una aplicación de autenticación (Google Authenticator, 1Password, Authy, etc.).",
        step1: "Abre tu aplicación de autenticación.",
        step2:
          "Registra el siguiente secreto como cadena Base32, o pega la URL otpauth en tu aplicación.",
        step3: "Introduce el código de 6 dígitos y pulsa Verificar.",
        secretLabel: "Secreto (Base32)",
        otpauthLabel: "URL otpauth:",
        codeLabel: "Código de 6 dígitos",
        verify: "Verificar",
        codeMismatch: "El código es incorrecto",
        errorPrefix: "Error:",
        retrySignin: "Reintentar inicio de sesión",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
