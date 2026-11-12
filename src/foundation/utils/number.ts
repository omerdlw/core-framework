/**
 * Coerces a value to a number and limits it to the min..max range.
 */
export function clamp(value: unknown, min: number, max: number): number {
  const num = Number(value);
  const finite = Number.isFinite(num) ? num : min;
  return Math.min(Math.max(finite, min), max);
}

/**
 * Coerces a value to a number, returning the fallback when not finite.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
