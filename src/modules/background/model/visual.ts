import { type CSSProperties } from "react";

import {
  type BackgroundMediaStyle,
  type FadeEdges,
  type VideoOptions,
} from "../types";

const objectFit = (value: string): CSSProperties => ({
  objectFit: value as CSSProperties["objectFit"],
});

const objectPosition = (value: string): CSSProperties => ({
  objectPosition: value,
});

/**
 * Maps Tailwind-style `bg-*` tokens to the object-fit/position styles they stand for.
 */
export const BG_TOKEN_TO_OBJECT_STYLE: Readonly<Record<string, CSSProperties>> =
  Object.freeze({
    "bg-bottom": objectPosition("bottom"),
    "bg-center": objectPosition("center"),
    "bg-contain": objectFit("contain"),
    "bg-cover": objectFit("cover"),
    "bg-fill": objectFit("fill"),
    "bg-left": objectPosition("left"),
    "bg-left-bottom": objectPosition("left bottom"),
    "bg-left-top": objectPosition("left top"),
    "bg-none": objectFit("none"),
    "bg-right": objectPosition("right"),
    "bg-right-bottom": objectPosition("right bottom"),
    "bg-right-top": objectPosition("right top"),
    "bg-scale-down": objectFit("scale-down"),
    "bg-top": objectPosition("top"),
  });

/**
 * The `object-fit` values accepted for a background video.
 */
export const OBJECT_FITS = Object.freeze([
  "contain",
  "cover",
  "fill",
  "none",
  "scale-down",
]);

/**
 * Color used for gradients and overlays when none is configured.
 */
export const DEFAULT_COLOR = "currentColor";

const WIDTH_CLASS = /^(w-|max-w-|min-w-)/;

/**
 * Splits class names into the object-fit/position styles, the width class and the rest.
 */
export function resolveVideoClassNames(
  ...inputs: (string | null | undefined)[]
): {
  objectStyle: CSSProperties;
  other: string;
  width: string;
} {
  const tokens = inputs
    .flatMap((input) =>
      typeof input === "string" ? input.replace(/,/g, " ").split(/\s+/) : [],
    )
    .filter(Boolean);

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the Object.assign spread overload is typed any
    objectStyle: Object.assign(
      {},
      ...(tokens.map((token) => BG_TOKEN_TO_OBJECT_STYLE[token]) as object[]),
    ),
    other: tokens.filter((token) => !WIDTH_CLASS.test(token)).join(" "),
    width: tokens.filter((token) => WIDTH_CLASS.test(token)).join(" "),
  };
}

/**
 * Fills the video options with their defaults.
 */
export function resolveVideoOptions(options: VideoOptions = {}) {
  return {
    codec: options.codec || "auto",
    corp: options.corp ?? 0,
    forceIframe: Boolean(options.forceIframe),
    isLoop: options.loop ?? false,
    isMuted: options.muted ?? true,
    playbackRate: options.playbackRate ?? 1,
    quality: options.quality || "1080p",
    shouldAutoPlay: options.autoplay ?? true,
    showPoster: Boolean(options.showPoster),
    showSpinner: options.showSpinner !== false,
  };
}

/**
 * CSS gradient that fades a color in from the given side.
 */
export const generateBaseGradient = (
  direction: "left" | "right",
  color: string,
): string => {
  const to = direction === "left" ? "to right" : "to left";
  return `linear-gradient(${to}, ${color} 0%, color-mix(in srgb, ${color} 85%, transparent) 15%, color-mix(in srgb, ${color} 50%, transparent) 45%, color-mix(in srgb, ${color} 18%, transparent) 75%, transparent 100%)`;
};

/**
 * CSS gradient for a video edge that fades a color in from the given side.
 */
export const generateEdgeGradient = (
  direction: "left" | "right",
  color: string,
): string => {
  const to = direction === "left" ? "to right" : "to left";
  return `linear-gradient(${to}, color-mix(in srgb, ${color} 95%, transparent) 0%, color-mix(in srgb, ${color} 70%, transparent) 25%, color-mix(in srgb, ${color} 35%, transparent) 55%, color-mix(in srgb, ${color} 10%, transparent) 80%, transparent 100%)`;
};

export function getVisualStyle(currentStyle: BackgroundMediaStyle = {}) {
  const {
    className: _className,
    leftGradient = 0,
    rightGradient = 0,
    ...baseStyle
  } = currentStyle;
  return {
    baseStyle: baseStyle,
    leftGradient: Number(leftGradient) || 0,
    rightGradient: Number(rightGradient) || 0,
  };
}

export function resolveGradientSettings({
  fadeEdges = null,
  hasWidth = false,
  leftGradient = 0,
  rightGradient = 0,
}: {
  fadeEdges?: FadeEdges | number | string | boolean | null;
  hasWidth?: boolean;
  leftGradient?: number;
  rightGradient?: number;
}) {
  let leftPercent = 0;
  let rightPercent = 0;
  if (leftGradient > 0)
    leftPercent = Math.min(48, Math.max(12, leftGradient * 7.5));
  else if (hasWidth && fadeEdges !== false) leftPercent = 20;
  if (rightGradient > 0)
    rightPercent = Math.min(48, Math.max(12, rightGradient * 7.5));
  else if (hasWidth && fadeEdges !== false) rightPercent = 20;
  if (typeof fadeEdges === "number") {
    leftPercent = fadeEdges;
    rightPercent = fadeEdges;
  } else if (typeof fadeEdges === "string") {
    const parsed = parseFloat(fadeEdges);
    if (!Number.isNaN(parsed)) {
      leftPercent = parsed;
      rightPercent = parsed;
    }
  } else if (typeof fadeEdges === "object" && fadeEdges !== null) {
    const edgeObj = fadeEdges as { left?: unknown; right?: unknown };
    if (edgeObj.left !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- fadeEdges.left is unknown user input; an object yields NaN, which falls back to 0 via || as before (behaviour kept in 6.0 restructure)
      leftPercent = parseFloat(String(edgeObj.left)) || 0;
    if (edgeObj.right !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- fadeEdges.right is unknown user input; an object yields NaN, which falls back to 0 via || as before (behaviour kept in 6.0 restructure)
      rightPercent = parseFloat(String(edgeObj.right)) || 0;
  } else if (fadeEdges === false) {
    leftPercent = 0;
    rightPercent = 0;
  }
  const leftOpacity = leftGradient > 0 ? Math.min(1, leftGradient * 0.22) : 0;
  const rightOpacity =
    rightGradient > 0 ? Math.min(1, rightGradient * 0.22) : 0;
  return {
    enabled: leftPercent > 0 || rightPercent > 0,
    leftOpacity,
    leftPercent,
    rightOpacity,
    rightPercent,
  };
}

function formatSmoothstepStop(
  strength: number,
  position: string,
  color: string,
) {
  if (strength === 0) return `transparent ${position}`;
  if (strength === 1) return `${color} ${position}`;
  return `color-mix(in srgb, ${color} ${Math.round(strength * 100)}%, transparent) ${position}`;
}

export function generateSmoothstepStops(
  percent: number,
  direction: "in" | "out" = "in",
  color = DEFAULT_COLOR,
): string[] {
  const steps = [
    { s: 0, t: 0 },
    { s: 0.06, t: 0.15 },
    { s: 0.22, t: 0.35 },
    { s: 0.47, t: 0.55 },
    { s: 0.76, t: 0.75 },
    { s: 0.93, t: 0.9 },
    { s: 1.0, t: 1.0 },
  ];
  if (direction === "in") {
    return steps.map(({ s, t }) =>
      formatSmoothstepStop(s, `${(t * percent).toFixed(1)}%`, color),
    );
  }
  return steps.map(({ s, t }) =>
    formatSmoothstepStop(
      1 - s,
      `${(100 - percent + t * percent).toFixed(1)}%`,
      color,
    ),
  );
}

/**
 * CSS mask image that fades a video's left and right edges to transparent.
 */
export function getEdgeFadeMask({
  color = DEFAULT_COLOR,
  leftPercent = 0,
  rightPercent = 0,
}: {
  color?: string;
  leftPercent?: number;
  rightPercent?: number;
}): string | undefined {
  if (leftPercent <= 0 && rightPercent <= 0) return undefined;
  const leftStops =
    leftPercent > 0
      ? generateSmoothstepStops(leftPercent, "in", color)
      : [`${color} 0%`];
  const rightStops =
    rightPercent > 0
      ? generateSmoothstepStops(rightPercent, "out", color)
      : [`${color} 100%`];
  return `linear-gradient(to right, ${leftStops.join(", ")}, ${rightStops.join(", ")})`;
}

/** Turns a configured width into a CSS length; numbers are pixels. */
export function resolveCssWidth(
  rawWidth: string | number | null | undefined,
): string | undefined {
  if (rawWidth === undefined || rawWidth === null || rawWidth === "") {
    return undefined;
  }
  return typeof rawWidth === "number" ? `${rawWidth}px` : String(rawWidth);
}
