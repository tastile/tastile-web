import type { Locale } from "@/shared/stores/locale-store";

// CLI consent page (Issue #153). The page is rendered as a Server Component,
// so all copy lives in this bundle — no JSX hardcoded literals (policy §11).

export const cliAuth = {
  en: {
    cliAuth: {
      pageTitle: "Authorize application",
      clientId: "Application",
      requestingScopes: "Requested permissions",
      scopesRead: "Read your Tiles, Calendar, and Notifications",
      scopesWrite: "Create and modify Tiles and Change Sets",
      scopesNote:
        "Tastile will mint a short-lived API token on your behalf. The token is sent to your local CLI only — never stored on this page.",
      allow: "Allow",
      deny: "Deny",
      expired:
        "This authorization request has expired or already been confirmed.",
      errorMissingTitle: "Authorization request not found",
      errorMissingBody:
        "The authorization request is no longer valid. Please restart the CLI to try again.",
      errorExpiredTitle: "Authorization request expired",
      errorExpiredBody:
        "The 5-minute consent window closed before you confirmed. Please restart the CLI to try again.",
      errorConsumedTitle: "Authorization request already confirmed",
      errorConsumedBody:
        "This authorization request has already been confirmed in another tab or device. Please restart the CLI if you want to authorize again.",
    },
  },
  ja: {
    cliAuth: {
      pageTitle: "アプリケーションの認可",
      clientId: "アプリケーション",
      requestingScopes: "要求されている権限",
      scopesRead: "Tile・カレンダー・通知の読み取り",
      scopesWrite: "Tile・Change Set の作成と変更",
      scopesNote:
        "Tastile はあなたの代わりに短命な API トークンを発行します。トークンはローカルの CLI にのみ送られ、このページには保存されません。",
      allow: "許可",
      deny: "拒否",
      expired:
        "この認可リクエストは有効期限が切れているか、すでに確認済みです。",
      errorMissingTitle: "認可リクエストが見つかりません",
      errorMissingBody:
        "認可リクエストは有効ではありません。CLI を再起動してやり直してください。",
      errorExpiredTitle: "認可リクエストの有効期限切れ",
      errorExpiredBody:
        "5 分の同意ウィンドウが閉じる前に確認できませんでした。CLI を再起動してやり直してください。",
      errorConsumedTitle: "認可リクエストはすでに確認済みです",
      errorConsumedBody:
        "この認可リクエストは別のタブまたはデバイスで既に確認されています。再度認可する場合は CLI を再起動してください。",
    },
  },
  "zh-CN": {
    cliAuth: {
      pageTitle: "授权应用程序",
      clientId: "应用程序",
      requestingScopes: "请求的权限",
      scopesRead: "读取你的 Tile、日历和通知",
      scopesWrite: "创建和修改 Tile 与 Change Set",
      scopesNote:
        "Tastile 将代表你生成一个短期 API 令牌。该令牌只会发送到你的本地 CLI,不会保存在此页面。",
      allow: "允许",
      deny: "拒绝",
      expired: "此授权请求已过期或已被确认。",
      errorMissingTitle: "未找到授权请求",
      errorMissingBody: "授权请求已无效。请重新启动 CLI 再试一次。",
      errorExpiredTitle: "授权请求已过期",
      errorExpiredBody: "5 分钟同意窗口已关闭。请重新启动 CLI 再试一次。",
      errorConsumedTitle: "授权请求已被确认",
      errorConsumedBody: "此授权请求已在其他标签或设备被确认。如需重新授权,请重新启动 CLI。",
    },
  },
  ko: {
    cliAuth: {
      pageTitle: "애플리케이션 승인",
      clientId: "애플리케이션",
      requestingScopes: "요청된 권한",
      scopesRead: "Tile, 캘린더, 알림 읽기",
      scopesWrite: "Tile 및 Change Set 생성 및 수정",
      scopesNote:
        "Tastile이 사용자를 대신하여 단기 API 토큰을 발급합니다. 토큰은 로컬 CLI로만 전송되며 이 페이지에는 저장되지 않습니다.",
      allow: "허용",
      deny: "거부",
      expired: "이 인증 요청은 만료되었거나 이미 확인되었습니다.",
      errorMissingTitle: "인증 요청을 찾을 수 없음",
      errorMissingBody: "인증 요청이 더 이상 유효하지 않습니다. CLI를 다시 시작해 주세요.",
      errorExpiredTitle: "인증 요청이 만료됨",
      errorExpiredBody:
        "5분 동의 창이 닫히기 전에 확인하지 않았습니다. CLI를 다시 시작해 주세요.",
      errorConsumedTitle: "인증 요청이 이미 확인됨",
      errorConsumedBody:
        "이 인증 요청은 이미 다른 탭이나 기기에서 확인되었습니다. 다시 인증하려면 CLI를 다시 시작하세요.",
    },
  },
  es: {
    cliAuth: {
      pageTitle: "Autorizar aplicación",
      clientId: "Aplicación",
      requestingScopes: "Permisos solicitados",
      scopesRead: "Leer tus Tiles, calendario y notificaciones",
      scopesWrite: "Crear y modificar Tiles y Change Sets",
      scopesNote:
        "Tastile generará un token de API de corta duración en tu nombre. El token solo se envía a tu CLI local — nunca se almacena en esta página.",
      allow: "Permitir",
      deny: "Denegar",
      expired:
        "Esta solicitud de autorización ha caducado o ya ha sido confirmada.",
      errorMissingTitle: "Solicitud de autorización no encontrada",
      errorMissingBody:
        "La solicitud de autorización ya no es válida. Reinicia el CLI para volver a intentarlo.",
      errorExpiredTitle: "Solicitud de autorización caducada",
      errorExpiredBody:
        "La ventana de consentimiento de 5 minutos se cerró antes de que confirmases. Reinicia el CLI para volver a intentarlo.",
      errorConsumedTitle: "Solicitud de autorización ya confirmada",
      errorConsumedBody:
        "Esta solicitud de autorización ya se confirmó en otra pestaña o dispositivo. Reinicia el CLI si quieres volver a autorizar.",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
