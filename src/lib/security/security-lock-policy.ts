export const SECURITY_LOCK_ENABLED_KEY = "tastile.securityLock.enabled";
export const SECURITY_LOCK_TIMEOUT_MINUTES_KEY = "tastile.securityLock.timeoutMinutes";
export const SECURITY_LOCK_LEFT_AT_KEY = "tastile.securityLock.leftAt";
export const SECURITY_LOCK_CREDENTIAL_ID_KEY = "tastile.securityLock.credentialId";

export function getEnabled(storage: Storage): boolean {
  // Default is OFF. Returns true only when the user explicitly stored "true".
  // null / unset / "false" / any other value → false.
  return storage.getItem(SECURITY_LOCK_ENABLED_KEY) === "true";
}

export function setEnabled(storage: Storage, enabled: boolean) {
  storage.setItem(SECURITY_LOCK_ENABLED_KEY, enabled ? "true" : "false");
}

export function getTimeoutMinutes(storage: Storage): number {
  const parsed = Number.parseInt(storage.getItem(SECURITY_LOCK_TIMEOUT_MINUTES_KEY) ?? "10", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 10;
}

export function setTimeoutMinutes(storage: Storage, minutes: number) {
  storage.setItem(SECURITY_LOCK_TIMEOUT_MINUTES_KEY, String(Math.min(Math.max(minutes, 1), 240)));
}

export function shouldRequireUnlock({
  enabled,
  timeoutMinutes,
  lastLeftAt,
  now,
}: {
  enabled: boolean;
  timeoutMinutes: number;
  lastLeftAt: number;
  now: number;
}) {
  if (!enabled || !Number.isFinite(lastLeftAt) || lastLeftAt <= 0) return false;
  return now - lastLeftAt >= Math.min(Math.max(timeoutMinutes, 1), 240) * 60_000;
}
