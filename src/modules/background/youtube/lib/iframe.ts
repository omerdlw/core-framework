export interface YouTubePlayer {
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

export interface YouTubePlayerEvent {
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

export const PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
} as const;

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

export function loadYouTubeIframeApi(): Promise<Window["YT"] | null> {
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

/** Converts a 0-1 volume to the YouTube player's 0-100 scale. */
export function toPlayerVolume(volume: number) {
  return Math.round(volume * 100);
}

export function setHighQuality(player?: YouTubePlayer) {
  player?.setPlaybackQualityRange?.("hd1080", "hd1080");
  player?.setPlaybackQuality?.("hd1080");
}
