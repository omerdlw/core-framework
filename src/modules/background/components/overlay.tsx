"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { useBackgroundOverlayModel } from "../hooks/use-background-overlay-model";
import { BackgroundGradients } from "./background-gradients";
import { EdgeGradient } from "./edge-gradient";
import { NativeVideo } from "./native-video";
import { NoiseOverlay } from "./noise-overlay";
import { SolidOverlay } from "./solid-overlay";
import { YouTubeBackgroundPlayer } from "../youtube/components/player";

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
          exit={{ ...motionConfig.exit, transition: exitTransition }}
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
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
