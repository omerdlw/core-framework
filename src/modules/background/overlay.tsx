"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { cn, report } from "@/utils";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { EASING_CURVES } from "@/tokens";
import { useModuleTheme, type ResolvedTheme } from "@/theme";
import { backgroundTheme } from "./constants";
import {
  DEFAULT_COLOR,
  OBJECT_FITS,
  generateBaseGradient,
  generateEdgeGradient,
  getEdgeFadeMask,
  getVisualStyle,
  resolveGradientSettings,
  resolveVideoClassNames,
  resolveVideoOptions,
} from "./visual";
import { applyVideoPlaybackState } from "./playback";
import {
  getBackgroundMotionConfig,
  toCssDelay,
  toCssDuration,
  toCssEasing,
} from "./motion";
import { useBackgroundActions, useBackgroundState } from "./hooks";
import { parseYouTubeUrlConfig } from "./youtube/parse";
import { YouTubeBackgroundPlayer } from "./youtube/player";
import {
  type BackgroundActions,
  type BackgroundThemeSlot,
} from "./types";

type Theme = ResolvedTheme<BackgroundThemeSlot>;

export function useNativeVideoModel({
  corp,
  isLoop,
  isMuted,
  isPlaying,
  playbackRate,
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay,
  src,
  style: _style,
  className: _className,
}: {
  className: string;
  corp: number;
  isLoop: boolean;
  isMuted: boolean;
  isPlaying?: boolean;
  playbackRate: number;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  shouldAutoPlay: boolean;
  src: string | undefined;
  style: CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.loop) {
      video.currentTime = 0;
      video
        .play()
        .catch((error) => report("Background loop play", error, "warn"));
      return;
    }
    video.pause();
    setVideoPlaying(false);
  }, [setVideoPlaying]);
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (
      video?.duration &&
      corp > 0 &&
      video.currentTime >= video.duration - corp
    ) {
      handleEnded();
    }
  }, [corp, handleEnded]);
  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
    if (!shouldAutoPlay) return;
    if (isMuted) video.muted = true;
    video
      .play()
      .then(() => setVideoPlaying(true))
      .catch((error) => {
        report("Background autoplay", error, "warn");
        setVideoPlaying(false);
      });
  };
  useEffect(() => {
    const video = videoRef.current;
    setVideoElement(video);
    return () => {
      try {
        video?.pause();
      } catch {}
    };
  }, [src, setVideoElement]);
  useEffect(() => () => setVideoElement(null), [setVideoElement]);
  useEffect(() => {
    applyVideoPlaybackState({
      isPlaying,
      playbackRate,
      setVideoPlaying,
      videoElement: videoRef.current,
    });
  }, [isPlaying, playbackRate, setVideoPlaying]);

  return { videoRef, handleEnded, handleTimeUpdate, handleLoadedData };
}

export function NativeVideo({
  corp,
  isLoop,
  isMuted,
  isPlaying,
  playbackRate,
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay,
  src,
  style,
  className,
}: {
  className: string;
  corp: number;
  isLoop: boolean;
  isMuted: boolean;
  isPlaying?: boolean;
  playbackRate: number;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  shouldAutoPlay: boolean;
  src: string | undefined;
  style: CSSProperties;
}) {
  const { videoRef, handleEnded, handleTimeUpdate, handleLoadedData } =
    useNativeVideoModel({
      corp,
      isLoop,
      isMuted,
      isPlaying,
      playbackRate,
      setVideoElement,
      setVideoPlaying,
      shouldAutoPlay,
      src,
      style,
      className,
    });
  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      preload="auto"
      muted={isMuted}
      loop={isLoop}
      playsInline
      style={style}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onLoadedData={handleLoadedData}
    />
  );
}

export const BackgroundGradients = memo(function BackgroundGradients({
  count = 0,
  direction,
  color = DEFAULT_COLOR,
  theme,
}: {
  theme: Theme;
  count?: number;
  direction: "left" | "right";
  color?: string;
}) {
  if (!count || count <= 0) return null;
  const opacity = Math.min(1, Math.max(0.2, count * 0.25));
  return (
    <div
      data-side={direction}
      className={theme.slots.gradient}
      style={{
        ...theme.styles.gradient,
        opacity,
        background: generateBaseGradient(direction, color),
      }}
    />
  );
});

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

export const SolidOverlay = memo(function SolidOverlay({
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
});

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
  const motionConfig = useMemo(
    () => getBackgroundMotionConfig(animation),
    [animation],
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
      transitionDuration: toCssDuration(motionConfig.transition.duration),
      transitionProperty: "opacity",
      transitionTimingFunction: toCssEasing(motionConfig.transition.ease),
    }),
    [motionConfig.transition],
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
  const exitDurationFactor = Number.isFinite(motionConfig.exitDurationFactor)
    ? Math.max(0, motionConfig.exitDurationFactor)
    : 0.6;
  const exitTransition = motionConfig.exit.transition as
    { duration?: number; ease?: unknown } | undefined;

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
    exitDurationFactor,
    exitTransition,
    theme,
  };
}

export function BackgroundOverlay() {
  const {
    hasBackground,
    image,
    isPlaying,
    isVideo,
    overlay,
    overlayColor,
    overlayOpacity,
    position,
    video,
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
    exitDurationFactor,
    exitTransition,
    theme,
  } = useBackgroundOverlayModel();

  return (
    <AnimatePresence mode="sync">
      {hasBackground && (
        <motion.div
          key={backgroundKey}
          initial={motionConfig.initial}
          animate={motionConfig.animate}
          transition={motionConfig.transition}
          exit={{
            ...motionConfig.exit,
            transition: {
              ...motionConfig.transition,
              delay: 0,
              duration:
                exitTransition?.duration ??
                (motionConfig.transition.duration ?? 0.6) * exitDurationFactor,
              ease: exitTransition?.ease ?? EASING_CURVES.IN_CUBIC,
            } as Transition,
          }}
          className={theme.slots.root}
          style={{
            willChange: "transform, opacity, filter",
            ...theme.styles.root,
          }}
        >
          {isVideo ? (
            <div
              data-position={framePosition}
              data-width={
                classNames.width || resolvedWidth ? undefined : "full"
              }
              className={cn(theme.slots.videoFrame, classNames.width)}
              style={{
                ...theme.styles.videoFrame,
                ...(resolvedWidth ? { width: resolvedWidth } : {}),
              }}
            >
              {youtubeConfig ? (
                <YouTubeBackgroundPlayer
                  videoId={youtubeConfig.videoId}
                  startTime={startTime}
                  endTime={endTime}
                  corp={corp}
                  isPlaying={isPlaying}
                  isMuted={isMuted}
                  isLoop={options.isLoop}
                  shouldAutoPlay={options.shouldAutoPlay}
                  showPoster={options.showPoster}
                  showSpinner={options.showSpinner}
                  playbackRate={playbackRate}
                  quality={options.quality}
                  codec={options.codec}
                  forceIframe={options.forceIframe}
                  posterUrl={options.showPoster ? image || null : null}
                  theme={theme}
                  videoClasses={videoClasses}
                  videoStyle={sharedVideoStyle}
                  setVideoElement={setVideoElement}
                  setVideoPlaying={setVideoPlaying}
                />
              ) : (
                <NativeVideo
                  src={video || undefined}
                  className={videoClasses}
                  style={sharedVideoStyle}
                  corp={corp}
                  isLoop={options.isLoop}
                  isMuted={isMuted}
                  isPlaying={isPlaying}
                  playbackRate={playbackRate}
                  shouldAutoPlay={options.shouldAutoPlay}
                  setVideoElement={setVideoElement}
                  setVideoPlaying={setVideoPlaying}
                />
              )}

              <EdgeGradient
                theme={theme}
                direction="left"
                percent={gradientSettings.leftPercent}
                opacity={gradientSettings.leftOpacity}
                color={overlayColor}
              />
              <EdgeGradient
                theme={theme}
                direction="right"
                percent={gradientSettings.rightPercent}
                opacity={gradientSettings.rightOpacity}
                color={overlayColor}
              />

              {hasCustomWidth && (
                <NoiseOverlay
                  theme={theme}
                  opacity={noiseOpacity}
                  blendMode={noiseBlendMode}
                  inlineStyle={noiseInlineStyle as CSSProperties}
                  maskImage={maskImage}
                />
              )}

              {hasCustomWidth && overlay && (
                <SolidOverlay
                  theme={theme}
                  opacity={overlayOpacity}
                  color={overlayColor}
                  transitionStyle={overlayTransitionStyle}
                  maskImage={maskImage}
                />
              )}
            </div>
          ) : (
            <div
              className={theme.slots.image}
              style={{
                backgroundImage: image ? `url(${image})` : undefined,
                backgroundPosition: position,
                ...baseStyle,
              }}
            />
          )}

          {(!isVideo || !hasCustomWidth) && (
            <>
              <BackgroundGradients
                theme={theme}
                count={leftGradient}
                direction="left"
                color={overlayColor}
              />
              <BackgroundGradients
                theme={theme}
                count={rightGradient}
                direction="right"
                color={overlayColor}
              />
              <NoiseOverlay
                theme={theme}
                isFixed
                opacity={noiseOpacity}
                blendMode={noiseBlendMode}
                inlineStyle={noiseInlineStyle as CSSProperties}
              />
              {overlay && (
                <SolidOverlay
                  theme={theme}
                  opacity={overlayOpacity}
                  color={overlayColor}
                  transitionStyle={overlayTransitionStyle}
                />
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
