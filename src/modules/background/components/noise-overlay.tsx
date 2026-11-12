"use client";

import { memo, type CSSProperties } from "react";
import { type Theme } from "../lib/theme";

export const NoiseOverlay = memo(function NoiseOverlay({
  opacity,
  blendMode,
  inlineStyle,
  maskImage,
  isFixed,
  theme,
}: {
  theme: Theme;
  opacity?: number;
  blendMode?: string;
  inlineStyle?: CSSProperties;
  maskImage?: string;
  isFixed?: boolean;
}) {
  return (
    <div
      data-position={isFixed ? "fixed" : "absolute"}
      className={theme.slots.noise}
      style={{
        ...theme.styles.noise,
        ...(typeof opacity === "number" ? { opacity } : {}),
        ...(typeof blendMode === "string" && blendMode.trim()
          ? { mixBlendMode: blendMode as CSSProperties["mixBlendMode"] }
          : {}),
        ...(maskImage ? { maskImage, WebkitMaskImage: maskImage } : {}),
        ...inlineStyle,
      }}
    />
  );
});
