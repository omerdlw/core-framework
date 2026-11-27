"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";

import { DEFAULT_AUDIBLE_VOLUME } from "../constants";
import type { BackgroundActions } from "../types";
import {
  buildPlayerVars,
  createIframePlaybackState,
  createIframeProxyController,
  type IframePlaybackState,
  loadYouTubeIframeApi,
  PLAYER_STATE,
  setHighQuality,
  toPlayerVolume,
  type YouTubeLiveState,
  type YouTubePlayer,
  type YouTubePlayerEvent,
} from "./iframe";
import { createYouTubeVideoElementProxy } from "./parse";
import { resolveIframeSafetyEnd } from "./timing";

const PROGRESS_INTERVAL_MS = 200;

// The try/catch helpers live at module level: the compiler cannot lower
// optional chaining inside a try block in a hook.

/** Destroys an iframe player; a player already torn down may throw. */
function destroyQuietly(player: YouTubePlayer | null) {
  try {
    player?.destroy?.();
  } catch {}
}

/** Pushes play, mute and rate to the iframe player; it may not be ready. */
function applyPlayerState(
  player: YouTubePlayer,
  {
    isMuted,
    isPlaying,
    playbackRate,
  }: { isMuted: boolean; isPlaying: boolean; playbackRate: number },
) {
  try {
    if (isPlaying) player.playVideo?.();
    else player.pauseVideo?.();
    if (isMuted) player.mute?.();
    else player.unMute?.();
    if (playbackRate) player.setPlaybackRate?.(playbackRate);
  } catch {
    // The player may be torn down between calls; the next sync retries.
  }
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
      destroyQuietly(playerRef.current);
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
    applyPlayerState(current, { isMuted, isPlaying, playbackRate });
  }, [enabled, isMuted, isPlaying, playbackRate]);
}

/** Everything the iframe player's event handlers read or update. */
export interface IframeEngineOptions {
  emit: (type: string) => void;
  getPlayer: () => YouTubePlayer | null;
  getProxy: () => HTMLVideoElement | null;
  isDisposed: () => boolean;
  live: { current: YouTubeLiveState };
  setIsBuffering: (buffering: boolean) => void;
  setIsFrameReady: (ready: boolean) => void;
  setPlayer: (player: YouTubePlayer | null) => void;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  startProgress: (tick: () => void) => void;
  state: IframePlaybackState;
}

/**
 * Builds the iframe player's ready / state-change handlers and its progress
 * tick, all sharing one playback snapshot.
 */
function createIframeEngine({
  emit,
  getPlayer,
  getProxy,
  isDisposed,
  live,
  setIsBuffering,
  setIsFrameReady,
  setPlayer,
  setVideoElement,
  setVideoPlaying,
  startProgress,
  state,
}: IframeEngineOptions) {
  const restart = (target?: YouTubePlayer | null) => {
    const restartAt = Math.max(0, live.current.startTime || 0);
    target?.seekTo?.(restartAt, true);
    target?.playVideo?.();
    return restartAt;
  };

  const trackProgress = () => {
    const current = getPlayer();
    if (!current || typeof current.getCurrentTime !== "function") return;

    const time = Number(current.getCurrentTime()) || 0;
    const duration = Number(current.getDuration?.()) || state.duration;
    state.currentTime = time;
    if (duration > 0 && duration !== state.duration) {
      state.duration = duration;
      emit("durationchange");
    }

    const { corp, endTime, isLoop: loops } = live.current;
    const safetyEnd = resolveIframeSafetyEnd(endTime, corp, duration);

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
    if (isDisposed()) return;
    const target = event.target;
    setPlayer(target ?? null);
    state.duration = Number(target?.getDuration?.()) || 0;

    const { isMuted: muted, isPlaying, playbackRate: rate } = live.current;
    if (rate !== 1) target?.setPlaybackRate?.(rate);
    if (muted) {
      target?.mute?.();
    } else {
      target?.unMute?.();
      target?.setVolume?.(toPlayerVolume(DEFAULT_AUDIBLE_VOLUME));
    }

    if (live.current.shouldAutoPlay && isPlaying) {
      setHighQuality(target);
      target?.playVideo?.();
      state.paused = false;
      setVideoPlaying(true);
    }

    const proxy = getProxy();
    if (proxy) {
      setVideoElement(proxy);
      emit("loadedmetadata");
      emit("durationchange");
    }
    startProgress(trackProgress);
  };

  const handleStateChange = (event: YouTubePlayerEvent) => {
    if (isDisposed()) return;
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
          restart(getPlayer());
        } else {
          state.paused = true;
          setVideoPlaying(false);
          emit("ended");
        }
        break;
    }
  };

  return { handleReady, handleStateChange };
}
