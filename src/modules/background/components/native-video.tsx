"use client";

import {
  type NativeVideoProps,
  useNativeVideoModel,
} from "../hooks/use-native-video-model";

/** A plain `<video>` background that plays, loops and reports its element. */
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
}: NativeVideoProps) {
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
