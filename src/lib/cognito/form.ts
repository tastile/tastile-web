export function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeCode(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "") : "";
}

export function authErrorMessage(code: string | null): string | null {
  switch (code) {
    case "missing_email":
      return "メールアドレスを入力してください。";
    case "missing_code":
      return "確認コードを入力してください。";
    case "invalid_code":
      return "確認コードが正しくありません。";
    case "expired_code":
      return "確認コードの期限が切れました。もう一度コードを送信してください。";
    case "user_exists":
      return "このメールアドレスは登録済みです。ログインしてください。";
    case "not_confirmed":
      return "アカウント確認がまだ完了していません。確認コードを入力してください。";
    case "otp_unavailable":
      return "このアカウントではメール OTP ログインを開始できませんでした。";
    case "auth_failed":
      return "認証を完了できませんでした。もう一度お試しください。";
    case "sent":
      return "確認コードを送信しました。メールをご確認ください。";
    case "confirmed":
      return "アカウント確認が完了しました。ログインしてください。";
    case "registered":
      return "アカウントを作成しました。ログインコードで続行してください。";
    default:
      return null;
  }
}
