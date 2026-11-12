function numberOf(value: unknown, fallback: number): number {
  const source =
    value &&
    typeof value === "object" &&
    "get" in value &&
    typeof value.get === "function"
      ? value.get()
      : value;
  const number = Number.parseFloat(String(source));
  return Number.isFinite(number) ? number : fallback;
}

export function gpuTransform(
  y: unknown = 0,
  scale: unknown = 1,
  x: unknown = 0,
): string {
  const translateY = Math.round(numberOf(y, 0));
  const translateX = Math.round(numberOf(x, 0));
  const scaleValue = Math.round(numberOf(scale, 1) * 1000) / 1000;
  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleValue})`;
}

export function cssEasing(ease: unknown): string {
  if (Array.isArray(ease)) return `cubic-bezier(${ease.join(", ")})`;
  if (typeof ease === "string" && ease.trim()) return ease;
  return "ease";
}

export function cssTransition(
  property: string,
  transition: { duration?: number; delay?: number; ease?: unknown },
): string {
  const duration = `${Math.round((transition.duration ?? 0) * 1000)}ms`;
  const delay = transition.delay
    ? ` ${Math.round(transition.delay * 1000)}ms`
    : "";
  return `${property} ${duration} ${cssEasing(transition.ease)}${delay}`;
}
