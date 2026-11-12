const MS_PER_SECOND = 1000;
// Scale is rounded to three decimals so transforms stay stable between frames.
const SCALE_PRECISION = 1000;

function numberOf(value: unknown, fallback: number): number {
  const source =
    value &&
    typeof value === "object" &&
    "get" in value &&
    typeof value.get === "function"
      ? (value.get as () => unknown)()
      : value;
  const number = Number.parseFloat(String(source));
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Builds a `translate3d` + `scale` transform string from numbers or motion values.
 */
export function gpuTransform(
  y: unknown = 0,
  scale: unknown = 1,
  x: unknown = 0,
): string {
  const translateY = Math.round(numberOf(y, 0));
  const translateX = Math.round(numberOf(x, 0));
  const scaleValue =
    Math.round(numberOf(scale, 1) * SCALE_PRECISION) / SCALE_PRECISION;
  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleValue})`;
}

/**
 * Converts a motion easing (cubic-bezier tuple or CSS keyword) to a CSS value.
 */
export function cssEasing(ease: unknown): string {
  if (Array.isArray(ease)) return `cubic-bezier(${ease.join(", ")})`;
  if (typeof ease === "string" && ease.trim()) return ease;
  return "ease";
}

/**
 * Builds a CSS `transition` entry for one property from a motion transition.
 */
export function cssTransition(
  property: string,
  transition: { duration?: number; delay?: number; ease?: unknown },
): string {
  const duration = `${Math.round((transition.duration ?? 0) * MS_PER_SECOND)}ms`;
  const delay = transition.delay
    ? ` ${Math.round(transition.delay * MS_PER_SECOND)}ms`
    : "";
  return `${property} ${duration} ${cssEasing(transition.ease)}${delay}`;
}
