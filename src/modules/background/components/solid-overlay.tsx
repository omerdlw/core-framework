import { type CSSProperties } from "react";

import { type Theme } from "../lib/theme";

export function SolidOverlay({
  opacity = 0,
  color,
  transitionStyle,
  maskImage,
  theme,
}: {
  theme: Theme;
  opacity?: number;
  color?: string;
  transitionStyle?: CSSProperties;
  maskImage?: string;
}) {
  return (
    <div
      className={theme.slots.solid}
      style={{
        opacity,
        backgroundColor: color,
        ...(maskImage ? { maskImage, WebkitMaskImage: maskImage } : {}),
        ...transitionStyle,
      }}
    />
  );
}
