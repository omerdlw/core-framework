"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";

import { type BackgroundActions } from "../../types";
import {
  loadYouTubeIframeApi,
  type YouTubeLiveState,
  type YouTubePlayer,
} from "../lib/iframe";
import { createIframeEngine } from "../lib/iframe-engine";
import {
  buildPlayerVars,
  createIframePlaybackState,
  createIframeProxyController,
} from "../lib/iframe-proxy";
import { createYouTubeVideoElementProxy } from "../lib/parse";

const PROGRESS_INTERVAL_MS = 200;

export function useYouTubeIframePlayer({
  enabled,
  hostRef,
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
}: {
  enabled: boolean;
  hostRef: RefObject<HTMLDivElement | null>;
  isLoop: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  live: MutableRefObject<YouTubeLiveState>;
  playbackRate: number;
  setIsBuffering: Dispatch<SetStateAction<boolean>>;
  setIsFrameReady: Dispatch<SetStateAction<boolean>>;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  shouldAutoPlay: boolean;
  startTime: number;
  videoId: string;
}) {
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let isDisposed = false;
    let progressInterval: number | null = null;
    let proxyElement: HTMLVideoElement | null = null;

    const state = createIframePlaybackState({
      isLoop,
      isMuted,
      playbackRate,
      shouldAutoPlay,
      startTime,
    });
    const player = () => playerRef.current;
    const emit = (type: string) => proxyElement?.dispatchEvent(new Event(type));
    const { handleReady, handleStateChange } = createIframeEngine({
      emit,
      getPlayer: player,
      getProxy: () => proxyElement,
      isDisposed: () => isDisposed,
      live,
      setIsBuffering,
      setIsFrameReady,
      setPlayer: (next) => {
        playerRef.current = next;
      },
      setVideoElement,
      setVideoPlaying,
      startProgress: (tick) => {
        progressInterval = window.setInterval(tick, PROGRESS_INTERVAL_MS);
      },
      state,
    });

    void loadYouTubeIframeApi().then((YT) => {
      const host = hostRef.current;
      if (isDisposed || !YT?.Player || !host) return;

      host.innerHTML = "";
      const mountTarget = document.createElement("div");
      host.appendChild(mountTarget);

      proxyElement = createYouTubeVideoElementProxy(
        createIframeProxyController({ player, setVideoPlaying, state }),
      );

      const initial = live.current;
      playerRef.current = new YT.Player(mountTarget, {
        events: { onReady: handleReady, onStateChange: handleStateChange },
        host: "https://www.youtube-nocookie.com",
        playerVars: buildPlayerVars(initial, videoId),
        videoId,
      });
    });

    return () => {
      isDisposed = true;
      if (progressInterval !== null) window.clearInterval(progressInterval);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      setVideoElement(null);
    };
  }, [
    enabled,
    hostRef,
    isLoop,
    isMuted,
    live,
    playbackRate,
    setIsBuffering,
    setIsFrameReady,
    setVideoElement,
    setVideoPlaying,
    shouldAutoPlay,
    startTime,
    videoId,
  ]);

  useEffect(() => {
    const current = playerRef.current;
    if (!enabled || !current) return;
    try {
      if (isPlaying) current.playVideo?.();
      else current.pauseVideo?.();
      if (isMuted) current.mute?.();
      else current.unMute?.();
      if (playbackRate) current.setPlaybackRate?.(playbackRate);
    } catch {}
  }, [enabled, isMuted, isPlaying, playbackRate]);
}
