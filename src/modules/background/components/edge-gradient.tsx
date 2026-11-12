"use client";

import { memo } from "react";
import { type Theme } from "../lib/theme";
import { DEFAULT_COLOR, generateEdgeGradient } from "../model/visual";

export const EdgeGradient = memo(function EdgeGradient({
  direction,
  percent = 0,
  opacity = 0,
  color,
  theme,
}: {
  theme: Theme;
  direction: "left" | "right";
  percent?: number;
  opacity?: number;
  color?: string;
}) {
  if (opacity <= 0) return null;
  return (
    <div
      data-side={direction}
      className={theme.slots.edge}
      style={{
        width: `${Math.max(30, percent * 1.15)}%`,
        opacity,
        background: generateEdgeGradient(direction, color || DEFAULT_COLOR),
      }}
    />
  );
});
