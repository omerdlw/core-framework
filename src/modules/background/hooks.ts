"use client";

import { type CSSProperties, use, useMemo } from "react";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";
import { createStore } from "@/foundation/utils";
import { retime } from "@/foundation/utils/tempo";
import { useRequiredContext, useStore } from "@/react/hooks";
import { useMotionTokens, useTheme } from "@/react/theme";

import { backgroundTheme } from "./constants";
import { BackgroundContext } from "./context";
import {
  getBackgroundExitTransition,
  getBackgroundMotionConfig,
  toCssDelay,
  toCssDuration,
  toCssEasing,
  useBackgroundMotion,
} from "./motion";
import { DEFAULT_BACKGROUND_COMPUTED, INERT_BACKGROUND_ACTIONS } from "./state";
import type {
  BackgroundActions,
  BackgroundAnimationConfig,
  BackgroundPageConfig,
  BackgroundStateComputed,
} from "./types";
import {
  getVisualStyle,
  resolveVideoFrame,
  resolveVideoOptions,
} from "./visual";
import { parseYouTubeUrlConfig } from "./youtube/parse";

const NOOP_BACKGROUND_STORE = createStore<BackgroundStateComputed>(
  DEFAULT_BACKGROUND_COMPUTED,
);

/**
 * Registers a background for the current page and removes it on unmount.
 */
export function useBackgroundRegistration(
  config: BackgroundPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("background", config, options);
}

/**
 * Reads the resolved background state. Must be used inside `BackgroundProvider`.
 */
export function useBackgroundState(): BackgroundStateComputed {
  const { store } = useRequiredContext(
    BackgroundContext,
    "useBackgroundState",
    "BackgroundProvider",
  );
  return useStore(store);
}

/**
 * Returns the stable background actions. Must be used inside `BackgroundProvider`.
 */
export function useBackgroundActions(): BackgroundActions {
  return useRequiredContext(
    BackgroundContext,
    "useBackgroundActions",
    "BackgroundProvider",
  ).actions;
}

/**
 * Registers an optional page background and returns the state merged with the actions.
 */
export function useBackground(
  config?: BackgroundPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): BackgroundStateComputed & BackgroundActions {
  useBackgroundRegistration(config, options);

  const actions = useBackgroundActions();
  const state = useBackgroundState();

  // stable identity: part of the public hook contract
  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}

/**
 * Like `useBackgroundState`, but returns defaults outside a provider.
 * An optional selector narrows the subscription.
 */
export function useOptionalBackgroundState(): BackgroundStateComputed;
export function useOptionalBackgroundState<T>(
  selector: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalBackgroundState<T = BackgroundStateComputed>(
  selector?: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(BackgroundContext);
  return useStore(
    ctx?.store ?? NOOP_BACKGROUND_STORE,
    selector as (state: BackgroundStateComputed) => T,
    isEqual,
  );
}

/**
 * Like `useBackgroundActions`, but returns inert no-op actions outside a provider.
 */
export function useOptionalBackgroundActions(): BackgroundActions {
  const ctx = use(BackgroundContext);
  return ctx?.actions ?? INERT_BACKGROUND_ACTIONS;
}

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

/** Resolves the background's enter/exit motion and its CSS overlay transition. */
export function useBackgroundMotionModel(
  animation: BackgroundAnimationConfig | null | undefined,
) {
  const backgroundMotion = useBackgroundMotion();
  const { reduced, still, tempo } = useMotionTokens();
  const motionConfig = getBackgroundMotionConfig(
    backgroundMotion,
    retime(animation, { reduced, still, tempo }),
  );
  const overlayTransitionStyle: CSSProperties = {
    transitionDelay: toCssDelay(motionConfig.transition.delay),
    transitionDuration: toCssDuration(
      motionConfig.transition.duration,
      backgroundMotion.transition.duration,
    ),
    transitionProperty: "opacity",
    transitionTimingFunction: toCssEasing(motionConfig.transition.ease),
  };
  const exitTransition = getBackgroundExitTransition(
    backgroundMotion,
    motionConfig,
  );

  return { exitTransition, motionConfig, overlayTransitionStyle };
}
