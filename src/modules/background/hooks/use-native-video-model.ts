"use client";

import { type CSSProperties, useEffect, useRef } from "react";

import { report } from "@/foundation/utils";

import { applyVideoPlaybackState } from "../model/playback";
import { type BackgroundActions } from "../types";
import { isWithinCorp } from "../youtube/lib/timing";

export interface NativeVideoProps {
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
}

/** Pauses a video that may already be detached; a failure is irrelevant. */
function pauseQuietly(video: HTMLVideoElement | null) {
  try {
    video?.pause();
  } catch {}
}

export function useNativeVideoModel({
  corp,
  isMuted,
  isPlaying,
  playbackRate,
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay,
  src,
  style: _style,
  className: _className,
}: NativeVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Media event handlers on <video> only, so a new function per render is fine.
  const handleEnded = () => {
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
  };
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && isWithinCorp(video.currentTime, video.duration, corp)) {
      handleEnded();
    }
  };
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
      pauseQuietly(video);
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
