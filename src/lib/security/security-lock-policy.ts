export const SECURITY_LOCK_ENABLED_KEY = "tastile.securityLock.enabled";
export const SECURITY_LOCK_TIMEOUT_MINUTES_KEY = "tastile.securityLock.timeoutMinutes";
export const SECURITY_LOCK_LEFT_AT_KEY = "tastile.securityLock.leftAt";
export const SECURITY_LOCK_CREDENTIAL_ID_KEY = "tastile.securityLock.credentialId";

export function getSecurityLockEnabled(storage: Storage): boolean {
  return storage.getItem(SECURITY_LOCK_ENABLED_KEY) !== "false";
}

export function setSecurityLockEnabled(storage: Storage, enabled: boolean) {
  storage.setItem(SECURITY_LOCK_ENABLED_KEY, enabled ? "true" : "false");
}

export function getSecurityLockTimeoutMinutes(storage: Storage): number {
  const parsed = Number.parseInt(storage.getItem(SECURITY_LOCK_TIMEOUT_MINUTES_KEY) ?? "10", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 10;
}

export function setSecurityLockTimeoutMinutes(storage: Storage, minutes: number) {
  storage.setItem(SECURITY_LOCK_TIMEOUT_MINUTES_KEY, String(Math.min(Math.max(minutes, 1), 240)));
}

export function shouldRequireSecurityUnlock({
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
