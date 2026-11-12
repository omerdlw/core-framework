"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import {
  type BackgroundOverlayModel,
  useBackgroundOverlayModel,
} from "../hooks/use-background-overlay-model";
import { YouTubeBackgroundPlayer } from "../youtube/components/player";
import { BackgroundGradients } from "./background-gradients";
import { EdgeGradient } from "./edge-gradient";
import { NativeVideo } from "./native-video";
import { NoiseOverlay } from "./noise-overlay";
import { SolidOverlay } from "./solid-overlay";

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
