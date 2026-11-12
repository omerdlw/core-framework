"use client";

import { useTheme } from "@/react/theme";

import { backgroundTheme } from "../constants";
import { useBackgroundActions, useBackgroundState } from "../hooks";
import { resolveVideoFrame } from "../model/video-frame";
import { getVisualStyle, resolveVideoOptions } from "../model/visual";
import { parseYouTubeUrlConfig } from "../youtube/lib/parse";
import { useBackgroundMotionModel } from "./use-background-motion-model";

/** Identity of the current backdrop, so a change cross-fades instead of morphing. */
function resolveBackgroundKey({
  image,
  isVideo,
  video,
  youtubeVideoId,
}: {
  image: string | null | undefined;
  isVideo: boolean;
  video: string | null | undefined;
  youtubeVideoId: string | undefined;
}) {
  if (!isVideo) return image;
  return youtubeVideoId ? `youtube:${youtubeVideoId}` : video;
}

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
  const youtubeConfig = isYouTube ? parseYouTubeUrlConfig(video) : null;
  const startTime = videoOptions?.startTime ?? youtubeConfig?.startTime ?? 0;
  const endTime = videoOptions?.endTime ?? youtubeConfig?.endTime ?? 0;
  const backgroundKey = resolveBackgroundKey({
    image,
    isVideo,
    video,
    youtubeVideoId: youtubeConfig?.videoId,
  });
  const { exitTransition, motionConfig, overlayTransitionStyle } =
    useBackgroundMotionModel(animation);
  const {
    baseStyle,
    leftGradient: styleLeft,
    rightGradient: styleRight,
  } = getVisualStyle((isVideo ? videoStyle : imageStyle) || {});
  const leftGradient = configuredLeftGradient ?? styleLeft;
  const rightGradient = configuredRightGradient ?? styleRight;
  const {
    opacity: noiseOpacity,
    mixBlendMode: noiseBlendMode,
    ...noiseInlineStyle
  } = noiseStyle || {};
  const theme = useTheme(backgroundTheme);
  const {
    classNames,
    gradientSettings,
    hasCustomWidth,
    maskImage,
    resolvedWidth,
    sharedVideoStyle,
    videoClasses,
  } = resolveVideoFrame({
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
  });
  const framePosition =
    position === "left" || position === "right" ? position : "center";
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

export type BackgroundOverlayModel = ReturnType<
  typeof useBackgroundOverlayModel
>;
