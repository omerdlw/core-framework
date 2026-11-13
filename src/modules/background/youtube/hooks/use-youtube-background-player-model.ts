"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type YouTubeBackgroundPlayerProps } from "../../types";
import { syncCompanionAudioElements } from "../lib/audio";
import { scheduleRetryTimer } from "../lib/timing";
import {
  endVideoPlayback,
  handleCompanionAudioError,
  onCanPlay,
  onError,
  onLoadedData,
  onLoadedMetadata,
  onPause,
  onPlay,
  onPlaying,
  onSeeked,
  onTimeUpdate,
  playWithMutedFallback,
  type VideoEventContext,
} from "../lib/video-events";
import { useYouTubeIframePlayer } from "./use-youtube-iframe-player";
import { useYouTubeStreamSources } from "./use-youtube-stream-sources";
import { useYouTubeVideoSync } from "./use-youtube-video-sync";

export function useYouTubeBackgroundPlayerModel({
  codec = "auto",
  corp = 0,
  endTime = 0,
  forceIframe = false,
  isLoop = false,
  isMuted = true,
  isPlaying = true,
  playbackRate = 1,
  posterUrl = null,
  quality = "1080p",
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay = true,
  showPoster = false,
  showSpinner = true,
  startTime = 0,
  videoClasses: _videoClasses,
  videoId,
  videoStyle: _videoStyle,
}: YouTubeBackgroundPlayerProps) {
  const [useIframeFallback, setUseIframeFallback] = useState(
    Boolean(forceIframe),
  );
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeHostRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedVideoRef = useRef(false);
  const errorRetryCountRef = useRef(0);
  const audioErrorRetryCountRef = useRef(0);
  const retryTimerIdsRef = useRef(new Set<number>());
  const lastAudioSeekAtRef = useRef(0);
  const live = useRef({
    corp,
    endTime,
    isLoop,
    isMuted,
    isPlaying,
    playbackRate,
    shouldAutoPlay,
    startTime,
  });
  // Compiler exception (docs/architecture-and-rules.md): imperative player
  // callbacks read the latest props from live.current; render only writes it.
  // eslint-disable-next-line react-hooks/refs
  live.current = {
    corp,
    endTime,
    isLoop,
    isMuted,
    isPlaying,
    playbackRate,
    shouldAutoPlay,
    startTime,
  };
  useEffect(() => {
    // Resets the player state when the video changes; the player itself is
    // the external system these flags track.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUseIframeFallback(Boolean(forceIframe));
    setIsFrameReady(false);
    setIsBuffering(true);
    hasLoadedVideoRef.current = false;
    errorRetryCountRef.current = 0;
    audioErrorRetryCountRef.current = 0;
  }, [forceIframe, videoId]);
  const { audioStreamUrl, resolvedPoster, videoStreamUrl } =
    useYouTubeStreamSources({ codec, posterUrl, quality, showPoster, videoId });
  // kept: useYouTubeBackgroundPlayerModel is a compiler exception (docs/architecture-and-rules.md)
  const syncCompanionAudio = useCallback((forceSeek = false) => {
    syncCompanionAudioElements({
      audio: audioRef.current,
      forceSeek,
      seekClock: lastAudioSeekAtRef,
      video: videoRef.current,
    });
  }, []);
  // kept: useYouTubeBackgroundPlayerModel is a compiler exception (docs/architecture-and-rules.md)
  const playWithFallback = useCallback(
    (video: HTMLVideoElement, forceSeek: boolean, unlockAudio: boolean) => {
      playWithMutedFallback({
        forceSeek,
        live,
        setVideoPlaying,
        syncCompanionAudio,
        unlockAudio,
        video,
        videoRef,
      });
    },
    [setVideoPlaying, syncCompanionAudio],
  );
  const scheduleRetry = (callback: () => void, delay: number) => {
    scheduleRetryTimer(retryTimerIdsRef.current, callback, delay);
  };
  // kept: useYouTubeBackgroundPlayerModel is a compiler exception (docs/architecture-and-rules.md)
  const handleEnded = useCallback(() => {
    endVideoPlayback({
      audioRef,
      live,
      setVideoPlaying,
      syncCompanionAudio,
      videoRef,
    });
  }, [setVideoPlaying, syncCompanionAudio]);
  // kept: useYouTubeBackgroundPlayerModel is a compiler exception (docs/architecture-and-rules.md)
  const handleAudioError = useCallback(() => {
    handleCompanionAudioError({
      audioErrorRetryCountRef,
      audioRef,
      live,
      scheduleRetry,
      setUseIframeFallback,
      videoRef,
    });
  }, []);
  const videoContext: VideoEventContext = {
    audioRef,
    errorRetryCountRef,
    handleEnded,
    hasLoadedVideoRef,
    live,
    playWithFallback,
    playbackRate,
    scheduleRetry,
    setIsBuffering,
    setIsFrameReady,
    setUseIframeFallback,
    setVideoPlaying,
    startTime,
    syncCompanionAudio,
    videoRef,
  };
  useYouTubeVideoSync({
    audioRef,
    isMuted,
    isPlaying,
    playbackRate,
    retryTimerIdsRef,
    setVideoElement,
    setVideoPlaying,
    syncCompanionAudio,
    useIframeFallback,
    videoRef,
    videoStreamUrl,
  });
  useYouTubeIframePlayer({
    enabled: useIframeFallback,
    hostRef: iframeHostRef,
    isLoop,
    isMuted,
    isPlaying,
    live,
    playbackRate,
    setIsBuffering,
    setIsFrameReady,
    setVideoElement,
    setVideoPlaying,
    shouldAutoPlay,
    startTime,
    videoId,
  });
  const isCovered = !isFrameReady || (useIframeFallback && !isPlaying);
  const showSpinnerOverlay = showSpinner && (!isFrameReady || isBuffering);

  return {
    useIframeFallback,
    isFrameReady,
    setIsBuffering,
    videoRef,
    audioRef,
    iframeHostRef,
    videoStreamUrl,
    audioStreamUrl,
    resolvedPoster,
    syncCompanionAudio,
    handleEnded,
    handleTimeUpdate: () => onTimeUpdate(videoContext),
    handlePlay: () => onPlay(videoContext),
    handlePlaying: () => onPlaying(videoContext),
    handlePause: () => onPause(videoContext),
    handleSeeked: () => onSeeked(videoContext),
    handleCanPlay: () => onCanPlay(videoContext),
    handleLoadedMetadata: () => onLoadedMetadata(videoContext),
    handleLoadedData: () => onLoadedData(videoContext),
    handleError: () => onError(videoContext),
    handleAudioError,
    isCovered,
    showSpinnerOverlay,
  };
}
