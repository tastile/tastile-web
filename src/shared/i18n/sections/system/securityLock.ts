import type { Locale } from "@/shared/stores/locale-store";

export const securityLock = {
  en: {
    securityLock: {
      title: "Unlock Tastile",
      heading: "Tastile Security",
      subtitle: "Use the standard unlock method for this device to continue.",
      unlockAction: "Unlock with this device",
      continueAction: "Continue",
      errors: {
        credential: "Credential creation failed.",
        webauthn: "WebAuthn is unavailable.",
        platform: "Platform authenticator is unavailable.",
        unlockFailed: "Unlock failed.",
      },
    },
  },
  ja: {
    securityLock: {
      title: "Tastile のロック解除",
      heading: "Tastile セキュリティ",
      subtitle: "このデバイスの標準ロック解除方法で続行してください。",
      unlockAction: "このデバイスでロック解除",
      continueAction: "続行",
      errors: {
        credential: "Credential creation failed.",
        webauthn: "WebAuthn is unavailable.",
        platform: "Platform authenticator is unavailable.",
        unlockFailed: "ロック解除に失敗しました。",
      },
    },
  },
  "zh-CN": {
    securityLock: {
      title: "解锁 Tastile",
      heading: "Tastile 安全",
      subtitle: "请使用此设备的标准解锁方式以继续。",
      unlockAction: "使用此设备解锁",
      continueAction: "继续",
      errors: {
        credential: "Credential creation failed.",
        webauthn: "WebAuthn is unavailable.",
        platform: "Platform authenticator is unavailable.",
        unlockFailed: "解锁失败。",
      },
    },
  },
  ko: {
    securityLock: {
      title: "Tastile 잠금 해제",
      heading: "Tastile 보안",
      subtitle: "이 디바이스의 표준 잠금 해제 방식으로 계속하세요.",
      unlockAction: "이 디바이스로 잠금 해제",
      continueAction: "계속",
      errors: {
        credential: "Credential creation failed.",
        webauthn: "WebAuthn is unavailable.",
        platform: "Platform authenticator is unavailable.",
        unlockFailed: "잠금 해제에 실패했습니다.",
      },
    },
  },
  es: {
    securityLock: {
      title: "Desbloquear Tastile",
      heading: "Seguridad de Tastile",
      subtitle: "Utiliza el método de desbloqueo estándar de este dispositivo para continuar.",
      unlockAction: "Desbloquear con este dispositivo",
      continueAction: "Continuar",
      errors: {
        credential: "Credential creation failed.",
        webauthn: "WebAuthn is unavailable.",
        platform: "Platform authenticator is unavailable.",
        unlockFailed: "Error al desbloquear.",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;