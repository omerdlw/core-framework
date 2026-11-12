import { type Theme } from "../lib/theme";
import { DEFAULT_COLOR, generateBaseGradient } from "../model/visual";

export function BackgroundGradients({
  count = 0,
  direction,
  color = DEFAULT_COLOR,
  theme,
}: {
  theme: Theme;
  count?: number;
  direction: "left" | "right";
  color?: string;
}) {
  if (!count || count <= 0) return null;
  const opacity = Math.min(1, Math.max(0.2, count * 0.25));
  return (
    <div
      data-side={direction}
      className={theme.slots.gradient}
      style={{
        ...theme.styles.gradient,
        opacity,
        background: generateBaseGradient(direction, color),
      }}
    />
  );
}
