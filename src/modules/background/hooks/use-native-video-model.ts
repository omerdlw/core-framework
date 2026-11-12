"use client";

import { type CSSProperties, useCallback, useEffect, useRef } from "react";

import { report } from "@/foundation/utils";

import { applyVideoPlaybackState } from "../model/playback";
import { type BackgroundActions } from "../types";

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
