// src/components/schedule/clampRange.ts
export function clampRange(
  range: { start: string; end: string },
  maxDays = 31,
): { start: string; end: string } {
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const days = (endMs - startMs) / 86_400_000;
  if (days <= maxDays) return range;
  console.warn(`[schedule] range clamped from ${days.toFixed(1)}d to ${maxDays}d`);
  return {
    start: range.start,
    end: new Date(startMs + maxDays * 86_400_000).toISOString(),
  };
}
