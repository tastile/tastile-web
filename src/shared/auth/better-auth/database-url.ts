export function resolveAuthDatabaseUrl(
  directUrl: string | undefined,
  hyperdriveUrl: string | undefined,
): string | null {
  const direct = directUrl?.trim();
  if (direct) return direct;
  const hyperdrive = hyperdriveUrl?.trim();
  return hyperdrive || null;
}
