import { type CSSProperties } from "react";
import { type BackgroundMediaStyle, type FadeEdges, type VideoOptions } from "./types";

const objectFit = (value: string): CSSProperties => ({
  objectFit: value as CSSProperties["objectFit"],
});

const objectPosition = (value: string): CSSProperties => ({
  objectPosition: value,
});

export const BG_TOKEN_TO_OBJECT_STYLE: Readonly<Record<string, CSSProperties>> = Object.freeze({
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

export const OBJECT_FITS = Object.freeze(["contain", "cover", "fill", "none", "scale-down"]);

export const DEFAULT_COLOR = "var(--black, #000)";

const WIDTH_CLASS = /^(w-|max-w-|min-w-)/;

export function resolveVideoClassNames(...inputs: (string | null | undefined)[]): {
  objectStyle: CSSProperties;
  other: string;
  width: string;
} {
  const tokens = inputs
    .flatMap((input) => (typeof input === "string" ? input.replace(/,/g, " ").split(/\s+/) : []))
    .filter(Boolean);

  return {
    objectStyle: Object.assign({}, ...tokens.map((token) => BG_TOKEN_TO_OBJECT_STYLE[token])),
    other: tokens.filter((token) => !WIDTH_CLASS.test(token)).join(" "),
    width: tokens.filter((token) => WIDTH_CLASS.test(token)).join(" "),
  };
}

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

export const generateBaseGradient = (direction: "left" | "right", color: string): string => {
  const to = direction === "left" ? "to right" : "to left";
  return `linear-gradient(${to}, ${color} 0%, color-mix(in srgb, ${color} 85%, transparent) 15%, color-mix(in srgb, ${color} 50%, transparent) 45%, color-mix(in srgb, ${color} 18%, transparent) 75%, transparent 100%)`;
};

export const generateEdgeGradient = (direction: "left" | "right", color: string): string => {
  const to = direction === "left" ? "to right" : "to left";
  return `linear-gradient(${to}, color-mix(in srgb, ${color} 95%, transparent) 0%, color-mix(in srgb, ${color} 70%, transparent) 25%, color-mix(in srgb, ${color} 35%, transparent) 55%, color-mix(in srgb, ${color} 10%, transparent) 80%, transparent 100%)`;
};

export function getVisualStyle(currentStyle: BackgroundMediaStyle = {}) {
  const { className: _className, leftGradient = 0, rightGradient = 0, ...baseStyle } = currentStyle;
  return {
    baseStyle: baseStyle as CSSProperties,
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
  if (leftGradient > 0) leftPercent = Math.min(48, Math.max(12, leftGradient * 7.5));
  else if (hasWidth && fadeEdges !== false) leftPercent = 20;
  if (rightGradient > 0) rightPercent = Math.min(48, Math.max(12, rightGradient * 7.5));
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
    if (edgeObj.left !== undefined) leftPercent = parseFloat(String(edgeObj.left)) || 0;
    if (edgeObj.right !== undefined) rightPercent = parseFloat(String(edgeObj.right)) || 0;
  } else if (fadeEdges === false) {
    leftPercent = 0;
    rightPercent = 0;
  }
  const leftOpacity = leftGradient > 0 ? Math.min(1, leftGradient * 0.22) : 0;
  const rightOpacity = rightGradient > 0 ? Math.min(1, rightGradient * 0.22) : 0;
  return {
    enabled: leftPercent > 0 || rightPercent > 0,
    leftOpacity,
    leftPercent,
    rightOpacity,
    rightPercent,
  };
}

export function generateSmoothstepStops(
  percent: number,
  direction: "in" | "out" = "in",
  color = "var(--black, #000)",
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
      s === 0
        ? `transparent ${(t * percent).toFixed(1)}%`
        : s === 1
          ? `${color} ${(t * percent).toFixed(1)}%`
          : `color-mix(in srgb, ${color} ${Math.round(s * 100)}%, transparent) ${(t * percent).toFixed(1)}%`,
    );
  }
  return steps.map(({ s, t }) => {
    const alpha = 1 - s;
    return alpha === 0
      ? `transparent ${(100 - percent + t * percent).toFixed(1)}%`
      : alpha === 1
        ? `${color} ${(100 - percent + t * percent).toFixed(1)}%`
        : `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent) ${(100 - percent + t * percent).toFixed(1)}%`;
  });
}

export function getEdgeFadeMask({
  color = "var(--black, #000)",
  leftPercent = 0,
  rightPercent = 0,
}: {
  color?: string;
  leftPercent?: number;
  rightPercent?: number;
}): string | undefined {
  if (leftPercent <= 0 && rightPercent <= 0) return undefined;
  const leftStops =
    leftPercent > 0 ? generateSmoothstepStops(leftPercent, "in", color) : [`${color} 0%`];
  const rightStops =
    rightPercent > 0 ? generateSmoothstepStops(rightPercent, "out", color) : [`${color} 100%`];
  return `linear-gradient(to right, ${leftStops.join(", ")}, ${rightStops.join(", ")})`;
}
