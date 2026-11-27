import type { CSSProperties } from "react";

import { cn } from "@/foundation/recipes/cn";

import type { Theme } from "./constants";
import type {
  BackgroundMediaStyle,
  BackgroundState,
  FadeEdges,
  VideoOptions,
} from "./types";

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

/** Edge fade, in percent of the width, per unit of gradient strength. */
const FADE_PERCENT_PER_STRENGTH = 7.5;
const MIN_FADE_PERCENT = 12;
const MAX_FADE_PERCENT = 48;
/** Edge fade used when the video has a custom width but no gradient strength. */
const WIDTH_FADE_PERCENT = 20;
/** Overlay opacity per unit of gradient strength. */
const OPACITY_PER_STRENGTH = 0.22;

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

/**
 * Splits a media style into the plain CSS and the two gradient strengths.
 */
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

const fadePercentFor = (strength: number) =>
  Math.min(
    MAX_FADE_PERCENT,
    Math.max(MIN_FADE_PERCENT, strength * FADE_PERCENT_PER_STRENGTH),
  );

const opacityFor = (strength: number) =>
  strength > 0 ? Math.min(1, strength * OPACITY_PER_STRENGTH) : 0;

/**
 * Edge fade widths and overlay opacities from gradient strengths; an explicit
 * `fadeEdges` value overrides the widths.
 */
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
  const widthFade = hasWidth && fadeEdges !== false ? WIDTH_FADE_PERCENT : 0;
  let leftPercent = leftGradient > 0 ? fadePercentFor(leftGradient) : widthFade;
  let rightPercent =
    rightGradient > 0 ? fadePercentFor(rightGradient) : widthFade;
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
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- user input; an object parses to NaN and falls back to 0
      leftPercent = parseFloat(String(edgeObj.left)) || 0;
    if (edgeObj.right !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- user input; an object parses to NaN and falls back to 0
      rightPercent = parseFloat(String(edgeObj.right)) || 0;
  } else if (fadeEdges === false) {
    leftPercent = 0;
    rightPercent = 0;
  }
  return {
    enabled: leftPercent > 0 || rightPercent > 0,
    leftOpacity: opacityFor(leftGradient),
    leftPercent,
    rightOpacity: opacityFor(rightGradient),
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

/**
 * Gradient stops that ease a color in (or out) over the first (or last)
 * `percent` of the width.
 */
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
function resolveCssWidth(
  rawWidth: string | number | null | undefined,
): string | undefined {
  if (rawWidth === undefined || rawWidth === null || rawWidth === "") {
    return undefined;
  }
  return typeof rawWidth === "number" ? `${rawWidth}px` : String(rawWidth);
}

type FrameInput = Pick<
  BackgroundState,
  | "className"
  | "fadeEdges"
  | "fit"
  | "overlayColor"
  | "position"
  | "videoClassName"
  | "videoOptions"
  | "videoStyle"
  | "width"
> & {
  baseStyle: CSSProperties;
  leftGradient: number | undefined;
  rightGradient: number | undefined;
  theme: Theme;
};

/** Sizing, fit, edge fade and class names for the video frame. */
export function resolveVideoFrame({
  baseStyle,
  className,
  fadeEdges,
  fit,
  leftGradient,
  overlayColor,
  position,
  rightGradient,
  theme,
  videoClassName,
  videoOptions,
  videoStyle,
  width,
}: FrameInput) {
  const resolvedWidth = resolveCssWidth(
    width ?? videoOptions?.width ?? videoStyle?.width,
  );
  const rawFit = fit ?? videoOptions?.fit ?? videoOptions?.objectFit;
  const fitStyle: CSSProperties =
    rawFit && OBJECT_FITS.includes(rawFit)
      ? { objectFit: rawFit as CSSProperties["objectFit"] }
      : {};
  const classNames = resolveVideoClassNames(
    videoClassName,
    className,
    videoOptions?.videoClassName,
    videoOptions?.className,
    videoStyle?.className,
  );
  const hasCustomWidth = Boolean(resolvedWidth || classNames.width);
  const gradientSettings = resolveGradientSettings({
    fadeEdges,
    hasWidth: hasCustomWidth,
    leftGradient,
    rightGradient,
  });
  const maskImage = gradientSettings.enabled
    ? getEdgeFadeMask({
        color: overlayColor || DEFAULT_COLOR,
        leftPercent: gradientSettings.leftPercent,
        rightPercent: gradientSettings.rightPercent,
      })
    : undefined;
  const videoClasses = cn(theme.slots.video, classNames.other);
  const objectPosition = baseStyle.objectPosition || position || undefined;
  const sharedVideoStyle: CSSProperties = {
    ...classNames.objectStyle,
    ...fitStyle,
    ...(objectPosition ? { objectPosition } : {}),
    ...(maskImage ? { WebkitMaskImage: maskImage, maskImage } : {}),
    ...baseStyle,
  };

  return {
    classNames,
    gradientSettings,
    hasCustomWidth,
    maskImage,
    resolvedWidth,
    sharedVideoStyle,
    videoClasses,
  };
}
