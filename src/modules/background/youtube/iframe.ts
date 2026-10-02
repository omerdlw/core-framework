"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { createYouTubeVideoElementProxy } from "./parse";
import { type BackgroundActions } from "../types";

interface YouTubePlayer {
  destroy?(): void;
  getCurrentTime?(): number;
  getDuration?(): number;
  mute?(): void;
  pauseVideo?(): void;
  playVideo?(): void;
  seekTo?(seconds: number, allowSeekAhead?: boolean): void;
  setPlaybackQuality?(quality: string): void;
  setPlaybackQualityRange?(min: string, max: string): void;
  setPlaybackRate?(rate: number): void;
  setVolume?(volume: number): void;
  unMute?(): void;
}

interface YouTubePlayerEvent {
  data?: number;
  target?: YouTubePlayer;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: Record<string, unknown>,
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

export interface YouTubeLiveState {
  corp: number;
  endTime: number;
  isLoop: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  playbackRate: number;
  shouldAutoPlay: boolean;
  startTime: number;
}

let apiPromise: Promise<Window["YT"] | null> | null = null;

function loadYouTubeIframeApi(): Promise<Window["YT"] | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT);
    };

    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

function setHighQuality(player?: YouTubePlayer) {
  player?.setPlaybackQualityRange?.("hd1080", "hd1080");
  player?.setPlaybackQuality?.("hd1080");
}

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

    const state = {
      currentTime: startTime || 0,
      duration: 0,
      loop: Boolean(isLoop),
      muted: Boolean(isMuted),
      paused: !shouldAutoPlay,
      playbackRate: Number(playbackRate) || 1,
      volume: isMuted ? 0 : 0.8,
    };
    const player = () => playerRef.current;
    const restart = (target?: YouTubePlayer | null) => {
      const restartAt = Math.max(0, live.current.startTime || 0);
      target?.seekTo?.(restartAt, true);
      target?.playVideo?.();
      return restartAt;
    };
    const emit = (type: string) => proxyElement?.dispatchEvent(new Event(type));

    const trackProgress = () => {
      const current = player();
      if (!current || typeof current.getCurrentTime !== "function") return;

      const time = Number(current.getCurrentTime()) || 0;
      const duration = Number(current.getDuration?.()) || state.duration;
      state.currentTime = time;
      if (duration > 0 && duration !== state.duration) {
        state.duration = duration;
        emit("durationchange");
      }

      const { corp, endTime, isLoop: loops } = live.current;
      const safetyEnd =
        endTime > 0
          ? endTime
          : duration > 0
            ? duration - Math.max(corp, 0.4)
            : 0;

      if (safetyEnd > 0 && time >= safetyEnd) {
        if (state.loop || loops) {
          state.currentTime = restart(current);
        } else {
          current.pauseVideo?.();
          state.paused = true;
          setVideoPlaying(false);
        }
      }
      emit("timeupdate");
    };

    const handleReady = (event: YouTubePlayerEvent) => {
      if (isDisposed) return;
      const target = event.target;
      playerRef.current = target ?? null;
      state.duration = Number(target?.getDuration?.()) || 0;

      const { isMuted: muted, isPlaying, playbackRate: rate } = live.current;
      if (rate !== 1) target?.setPlaybackRate?.(rate);
      if (muted) {
        target?.mute?.();
      } else {
        target?.unMute?.();
        target?.setVolume?.(80);
      }

      if (live.current.shouldAutoPlay && isPlaying) {
        setHighQuality(target);
        target?.playVideo?.();
        state.paused = false;
        setVideoPlaying(true);
      }

      if (proxyElement) {
        setVideoElement(proxyElement);
        emit("loadedmetadata");
        emit("durationchange");
      }
      progressInterval = window.setInterval(trackProgress, 200);
    };

    const handleStateChange = (event: YouTubePlayerEvent) => {
      if (isDisposed) return;
      switch (event.data) {
        case PLAYER_STATE.PLAYING:
          setHighQuality(event.target);
          state.paused = false;
          setIsFrameReady(true);
          setIsBuffering(false);
          setVideoPlaying(true);
          emit("play");
          emit("playing");
          break;
        case PLAYER_STATE.BUFFERING:
          setIsBuffering(true);
          break;
        case PLAYER_STATE.PAUSED:
          state.paused = true;
          setIsBuffering(false);
          setVideoPlaying(false);
          emit("pause");
          break;
        case PLAYER_STATE.ENDED:
          if (state.loop || live.current.isLoop) {
            restart(player());
          } else {
            state.paused = true;
            setVideoPlaying(false);
            emit("ended");
          }
          break;
      }
    };

    loadYouTubeIframeApi().then((YT) => {
      const host = hostRef.current;
      if (isDisposed || !YT?.Player || !host) return;

      host.innerHTML = "";
      const mountTarget = document.createElement("div");
      host.appendChild(mountTarget);

      proxyElement = createYouTubeVideoElementProxy({
        getCurrentTime: () => state.currentTime,
        getDuration: () => state.duration,
        getLoop: () => state.loop,
        getMuted: () => state.muted,
        getPaused: () => state.paused,
        getPlaybackRate: () => state.playbackRate,
        getVolume: () => state.volume,
        pause: () => {
          state.paused = true;
          player()?.pauseVideo?.();
          setVideoPlaying(false);
        },
        play: async () => {
          state.paused = false;
          player()?.playVideo?.();
          setVideoPlaying(true);
        },
        seekTo: (seconds) => {
          state.currentTime = seconds;
          player()?.seekTo?.(seconds, true);
          if (!state.paused) player()?.playVideo?.();
        },
        setLoop: (loop) => {
          state.loop = loop;
        },
        setMuted: (muted) => {
          state.muted = muted;
          if (muted) {
            player()?.mute?.();
            return;
          }
          player()?.unMute?.();
          if (state.volume === 0) {
            state.volume = 0.7;
            player()?.setVolume?.(70);
          }
        },
        setPlaybackRate: (rate) => {
          state.playbackRate = rate;
          player()?.setPlaybackRate?.(rate);
        },
        setVolume: (volume) => {
          state.volume = volume;
          player()?.setVolume?.(Math.round(volume * 100));
          if (volume > 0 && state.muted) {
            state.muted = false;
            player()?.unMute?.();
          } else if (volume === 0 && !state.muted) {
            state.muted = true;
            player()?.mute?.();
          }
        },
      });

      const initial = live.current;
      playerRef.current = new YT.Player(mountTarget, {
        events: { onReady: handleReady, onStateChange: handleStateChange },
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: initial.shouldAutoPlay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          loop: initial.isLoop ? 1 : 0,
          modestbranding: 1,
          mute: initial.isMuted ? 1 : 0,
          origin: window.location.origin,
          playlist: videoId,
          playsinline: 1,
          rel: 0,
          start: Math.floor(initial.startTime || 0),
        },
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
