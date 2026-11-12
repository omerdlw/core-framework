import { type BackgroundActions } from "../../types";
import {
  PLAYER_STATE,
  setHighQuality,
  type YouTubeLiveState,
  type YouTubePlayer,
  type YouTubePlayerEvent,
} from "./iframe";
import { type IframePlaybackState } from "./iframe-proxy";

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
export function createIframeEngine({
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
    const safetyEnd =
      endTime > 0 ? endTime : duration > 0 ? duration - Math.max(corp, 0.4) : 0;

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
      target?.setVolume?.(80);
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
