import { type CSSProperties } from "react";

import { cn } from "@/foundation/recipes/cn";

import { type Theme } from "../lib/theme";
import { type BackgroundState } from "../types";
import {
  DEFAULT_COLOR,
  getEdgeFadeMask,
  OBJECT_FITS,
  resolveCssWidth,
  resolveGradientSettings,
  resolveVideoClassNames,
} from "./visual";

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
