import { DEFAULT_AUDIBLE_VOLUME, PROXY_UNMUTE_VOLUME } from "../../constants";
import {
  type BackgroundActions,
  type YouTubeProxyController,
} from "../../types";
import {
  toPlayerVolume,
  type YouTubeLiveState,
  type YouTubePlayer,
} from "./iframe";

/** Mutable playback snapshot the proxy `<video>` element reports from. */
export interface IframePlaybackState {
  currentTime: number;
  duration: number;
  loop: boolean;
  muted: boolean;
  paused: boolean;
  playbackRate: number;
  volume: number;
}

/**
 * Builds the controller behind the proxy `<video>` element: reads come from
 * `state`, writes update `state` and forward to the live iframe player.
 */
export function createIframeProxyController({
  player,
  setVideoPlaying,
  state,
}: {
  player: () => YouTubePlayer | null;
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  state: IframePlaybackState;
}): YouTubeProxyController {
  return {
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
    // The controller contract is async; the YouTube player call is not.
    // eslint-disable-next-line @typescript-eslint/require-await
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
        state.volume = PROXY_UNMUTE_VOLUME;
        player()?.setVolume?.(toPlayerVolume(PROXY_UNMUTE_VOLUME));
      }
    },
    setPlaybackRate: (rate) => {
      state.playbackRate = rate;
      player()?.setPlaybackRate?.(rate);
    },
    setVolume: (volume) => {
      state.volume = volume;
      player()?.setVolume?.(toPlayerVolume(volume));
      if (volume > 0 && state.muted) {
        state.muted = false;
        player()?.unMute?.();
      } else if (volume === 0 && !state.muted) {
        state.muted = true;
        player()?.mute?.();
      }
    },
  };
}

/** Player parameters for the first iframe load, from the latest live props. */
export function buildPlayerVars(initial: YouTubeLiveState, videoId: string) {
  return {
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
  };
}

/** Initial playback snapshot of the proxy element, from the first props. */
export function createIframePlaybackState({
  isLoop,
  isMuted,
  playbackRate,
  shouldAutoPlay,
  startTime,
}: {
  isLoop: boolean;
  isMuted: boolean;
  playbackRate: number;
  shouldAutoPlay: boolean;
  startTime: number;
}): IframePlaybackState {
  return {
    currentTime: startTime || 0,
    duration: 0,
    loop: Boolean(isLoop),
    muted: Boolean(isMuted),
    paused: !shouldAutoPlay,
    playbackRate: Number(playbackRate) || 1,
    volume: isMuted ? 0 : DEFAULT_AUDIBLE_VOLUME,
  };
}
