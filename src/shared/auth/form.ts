export function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeCode(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "") : "";
}

export function authErrorMessage(code: string | null): string | null {
  switch (code) {
    case "missing_email":
      return "Please enter your email address.";
    case "missing_password":
      return "Please enter your password.";
    case "missing_code":
      return "Please enter the verification code.";
    case "invalid_code":
      return "The verification code is incorrect.";
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "weak_password":
      return "Password must be 12+ characters and include upper/lower case and digits.";
    case "expired_code":
      return "The verification code has expired. Please request a new one.";
    case "user_exists":
      return "This email is already registered. Please sign in.";
    case "not_confirmed":
      return "Account verification is incomplete. Please enter the verification code.";
    case "otp_unavailable":
      return "Could not start sign-in. Please check the configuration and try again.";
    case "auth_failed":
      return "Authentication could not be completed. Please try again.";
    case "sent":
      return "A verification code has been sent. Please check your email.";
    case "confirmed":
      return "Account verification is complete. Please sign in.";
    case "registered":
      return "Account created. Continue with the sign-in code.";
    default:
      return null;
  }
}
