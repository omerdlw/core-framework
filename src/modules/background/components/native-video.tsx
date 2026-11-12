"use client";

import { type CSSProperties } from "react";

import { useNativeVideoModel } from "../hooks/use-native-video-model";
import { type BackgroundActions } from "../types";

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
