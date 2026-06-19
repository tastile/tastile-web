/** Map a progress range [start, end] to [0, 1], clamped */
export function mapRange(progress: number, start: number, end: number): number {
  if (start >= end) return 0;
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

/** Ease-out cubic */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Interpolate a number */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
