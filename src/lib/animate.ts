/** Map a progress range [start, end] to [0, 1], clamped */
export function mapRange(progress: number, start: number, end: number): number {
  if (start >= end) return 0;
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

/** Ease-out cubic */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Ease-in-out cubic */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Interpolate a number */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Style helper: opacity from progress range */
export function opacity(progress: number, start: number, end: number): number {
  return easeOut(mapRange(progress, start, end));
}

/** Style helper: translateY from progress range (px) */
export function slideUp(progress: number, start: number, end: number, fromPx: number = 24): number {
  return lerp(fromPx, 0, easeOut(mapRange(progress, start, end)));
}

/** Style helper: translateX from progress range (px) */
export function slideRight(
  progress: number,
  start: number,
  end: number,
  fromPx: number = 32,
): number {
  return lerp(fromPx, 0, easeOut(mapRange(progress, start, end)));
}
