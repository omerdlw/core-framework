"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";

import { cn } from "@/foundation/recipes/cn";

import type { Theme } from "./constants";
import {
  type BackgroundOverlayModel,
  useBackgroundOverlayModel,
} from "./hooks";
import { NativeVideo } from "./native-video";
import {
  DEFAULT_COLOR,
  generateBaseGradient,
  generateEdgeGradient,
} from "./visual";
import { YouTubeBackgroundPlayer } from "./youtube/player";

interface OverlayLayerProps {
  model: BackgroundOverlayModel;
}

function VideoSource({ model }: OverlayLayerProps) {
  const {
    corp,
    endTime,
    image,
    isMuted,
    isPlaying,
    options,
    playbackRate,
    setVideoElement,
    setVideoPlaying,
    sharedVideoStyle,
    startTime,
    theme,
    video,
    videoClasses,
    youtubeConfig,
  } = model;

  if (youtubeConfig) {
    return (
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
    );
  }

  return (
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
  );
}

function VideoFrame({ model }: OverlayLayerProps) {
  const {
    classNames,
    framePosition,
    gradientSettings,
    hasCustomWidth,
    maskImage,
    noiseBlendMode,
    noiseInlineStyle,
    noiseOpacity,
    overlay,
    overlayColor,
    overlayOpacity,
    overlayTransitionStyle,
    resolvedWidth,
    theme,
  } = model;

  return (
    <div
      data-position={framePosition}
      data-width={classNames.width || resolvedWidth ? undefined : "full"}
      className={cn(theme.slots.videoFrame, classNames.width)}
      style={{
        ...theme.styles.videoFrame,
        ...(resolvedWidth ? { width: resolvedWidth } : {}),
      }}
    >
      <VideoSource model={model} />

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
          inlineStyle={noiseInlineStyle}
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
  );
}

function ImageLayer({ model }: OverlayLayerProps) {
  const { baseStyle, image, position, theme } = model;

  return (
    <div
      className={theme.slots.image}
      style={{
        backgroundImage: image ? `url(${image})` : undefined,
        backgroundPosition: position,
        ...baseStyle,
      }}
    />
  );
}

function FullBleedEffects({ model }: OverlayLayerProps) {
  const {
    leftGradient,
    noiseBlendMode,
    noiseInlineStyle,
    noiseOpacity,
    overlay,
    overlayColor,
    overlayOpacity,
    overlayTransitionStyle,
    rightGradient,
    theme,
  } = model;

  return (
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
        inlineStyle={noiseInlineStyle}
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
  );
}

/**
 * Renders the page background (image or video) with its gradients, noise and
 * tint overlay. Mounted once by the background module as the app backdrop.
 */
export function BackgroundOverlay() {
  const model = useBackgroundOverlayModel();
  const {
    backgroundKey,
    exitTransition,
    hasBackground,
    hasCustomWidth,
    isVideo,
    motionConfig,
    theme,
  } = model;
  const showFullBleedEffects = !isVideo || !hasCustomWidth;

  return (
    <AnimatePresence mode="sync">
      {hasBackground && (
        <motion.div
          key={backgroundKey}
          initial={motionConfig.initial}
          animate={motionConfig.animate}
          transition={motionConfig.transition}
          exit={{ ...motionConfig.exit, transition: exitTransition }}
          className={theme.slots.root}
          style={{
            willChange: "transform, opacity, filter",
            ...theme.styles.root,
          }}
        >
          {isVideo ? (
            <VideoFrame model={model} />
          ) : (
            <ImageLayer model={model} />
          )}
          {showFullBleedEffects && <FullBleedEffects model={model} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BackgroundGradients({
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
}

export function EdgeGradient({
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
}

export function NoiseOverlay({
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
}

export function SolidOverlay({
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
}
