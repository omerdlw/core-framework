"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "@/foundation/recipes/cn";
import { retime } from "@/foundation/utils/tempo";
import { useModuleTheme, useMotionTokens } from "@/react/theme";
import { backgroundTheme } from "../constants";
import {
  DEFAULT_COLOR,
  OBJECT_FITS,
  getEdgeFadeMask,
  getVisualStyle,
  resolveGradientSettings,
  resolveVideoClassNames,
  resolveVideoOptions,
} from "../model/visual";
import {
  getBackgroundExitTransition,
  getBackgroundMotionConfig,
  toCssDelay,
  toCssDuration,
  toCssEasing,
  useBackgroundMotion,
} from "../motion";
import { useBackgroundActions, useBackgroundState } from "../hooks";
import { parseYouTubeUrlConfig } from "../youtube/lib/parse";

export function useBackgroundOverlayModel() {
  const {
    animation,
    className,
    fadeEdges,
    fit,
    hasBackground,
    image,
    imageStyle,
    isPlaying,
    isVideo,
    isYouTube,
    leftGradient: configuredLeftGradient,
    noiseStyle,
    overlay,
    overlayColor,
    overlayOpacity,
    position,
    rightGradient: configuredRightGradient,
    video,
    videoClassName,
    videoOptions,
    videoStyle,
    width,
  } = useBackgroundState();
  const { setVideoElement, setVideoPlaying } = useBackgroundActions();
  const options = resolveVideoOptions(videoOptions);
  const { corp, isMuted, playbackRate } = options;
  const youtubeConfig = useMemo(
    () => (isYouTube ? parseYouTubeUrlConfig(video) : null),
    [isYouTube, video],
  );
  const startTime = videoOptions?.startTime ?? youtubeConfig?.startTime ?? 0;
  const endTime = videoOptions?.endTime ?? youtubeConfig?.endTime ?? 0;
  const backgroundKey = isVideo
    ? youtubeConfig
      ? `youtube:${youtubeConfig.videoId}`
      : video
    : image;
  const backgroundMotion = useBackgroundMotion();
  const { reduced, still, tempo } = useMotionTokens();
  const motionConfig = useMemo(
    () =>
      getBackgroundMotionConfig(
        backgroundMotion,
        retime(animation, { reduced, still, tempo }),
      ),
    [animation, backgroundMotion, reduced, still, tempo],
  );
  const {
    baseStyle,
    leftGradient: styleLeft,
    rightGradient: styleRight,
  } = useMemo(
    () => getVisualStyle((isVideo ? videoStyle : imageStyle) || {}),
    [imageStyle, isVideo, videoStyle],
  );
  const leftGradient = configuredLeftGradient ?? styleLeft;
  const rightGradient = configuredRightGradient ?? styleRight;
  const {
    opacity: noiseOpacity,
    mixBlendMode: noiseBlendMode,
    ...noiseInlineStyle
  } = noiseStyle || {};
  const overlayTransitionStyle = useMemo<CSSProperties>(
    () => ({
      transitionDelay: toCssDelay(motionConfig.transition.delay),
      transitionDuration: toCssDuration(
        motionConfig.transition.duration,
        backgroundMotion.transition.duration,
      ),
      transitionProperty: "opacity",
      transitionTimingFunction: toCssEasing(motionConfig.transition.ease),
    }),
    [backgroundMotion.transition.duration, motionConfig.transition],
  );
  const rawWidth = width ?? videoOptions?.width ?? videoStyle?.width;
  const resolvedWidth =
    rawWidth === undefined || rawWidth === null || rawWidth === ""
      ? undefined
      : typeof rawWidth === "number"
        ? `${rawWidth}px`
        : String(rawWidth);
  const rawFit = fit ?? videoOptions?.fit ?? videoOptions?.objectFit;
  const theme = useModuleTheme(backgroundTheme);
  const fitStyle = useMemo<CSSProperties>(
    () =>
      rawFit && OBJECT_FITS.includes(rawFit)
        ? { objectFit: rawFit as CSSProperties["objectFit"] }
        : {},
    [rawFit],
  );
  const classNames = resolveVideoClassNames(
    videoClassName,
    className,
    videoOptions?.videoClassName,
    videoOptions?.className,
    videoStyle?.className,
  );
  const hasCustomWidth = Boolean(resolvedWidth || classNames.width);
  const gradientSettings = useMemo(
    () =>
      resolveGradientSettings({
        fadeEdges,
        hasWidth: hasCustomWidth,
        leftGradient,
        rightGradient,
      }),
    [fadeEdges, hasCustomWidth, leftGradient, rightGradient],
  );
  const maskImage = useMemo(
    () =>
      gradientSettings.enabled
        ? getEdgeFadeMask({
            color: overlayColor || DEFAULT_COLOR,
            leftPercent: gradientSettings.leftPercent,
            rightPercent: gradientSettings.rightPercent,
          })
        : undefined,
    [gradientSettings, overlayColor],
  );
  const framePosition =
    position === "left" || position === "right" ? position : "center";
  const videoClasses = cn(theme.slots.video, classNames.other);
  const objectPosition = baseStyle.objectPosition || position || undefined;
  const sharedVideoStyle = useMemo<CSSProperties>(
    () => ({
      ...classNames.objectStyle,
      ...fitStyle,
      ...(objectPosition ? { objectPosition } : {}),
      ...(maskImage ? { WebkitMaskImage: maskImage, maskImage } : {}),
      ...baseStyle,
    }),
    [baseStyle, classNames.objectStyle, fitStyle, maskImage, objectPosition],
  );
  const exitTransition = useMemo(
    () => getBackgroundExitTransition(backgroundMotion, motionConfig),
    [backgroundMotion, motionConfig],
  );

  return {
    className,
    hasBackground,
    image,
    isPlaying,
    isVideo,
    overlay,
    overlayColor,
    overlayOpacity,
    position,
    video,
    videoStyle,
    width,
    setVideoElement,
    setVideoPlaying,
    options,
    corp,
    isMuted,
    playbackRate,
    youtubeConfig,
    startTime,
    endTime,
    backgroundKey,
    motionConfig,
    baseStyle,
    leftGradient,
    rightGradient,
    noiseOpacity,
    noiseBlendMode,
    noiseInlineStyle,
    overlayTransitionStyle,
    resolvedWidth,
    classNames,
    hasCustomWidth,
    gradientSettings,
    maskImage,
    framePosition,
    videoClasses,
    sharedVideoStyle,
    exitTransition,
    theme,
  };
}
