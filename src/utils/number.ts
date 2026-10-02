export function clamp(value: unknown, min: number, max: number): number {
  const num = Number(value);
  const finite = Number.isFinite(num) ? num : min;
  return Math.min(Math.max(finite, min), max);
}

export function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
