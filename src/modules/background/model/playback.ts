import { DEFAULT_AUDIBLE_VOLUME } from "../constants";

/**
 * Applies the configured play state and playback rate to a video element,
 * handling blocked autoplay.
 */
export function applyVideoPlaybackState({
  isPlaying,
  playbackRate,
  setVideoPlaying,
  videoElement,
}: {
  isPlaying?: boolean;
  playbackRate?: number;
  setVideoPlaying: (playing: boolean) => void;
  videoElement?: HTMLVideoElement | null;
}): void {
  if (!videoElement) return;

  const numericPlaybackRate = Number(playbackRate);
  const resolvedPlaybackRate =
    Number.isFinite(numericPlaybackRate) && numericPlaybackRate > 0
      ? numericPlaybackRate
      : 1;

  try {
    if (videoElement.playbackRate !== resolvedPlaybackRate) {
      videoElement.playbackRate = resolvedPlaybackRate;
    }
  } catch {
    return;
  }

  if (!isPlaying) {
    if (!videoElement.paused) videoElement.pause();
    return;
  }

  if (videoElement.readyState === 0) {
    return;
  }

  const playPromise = videoElement.play();
  // Older browsers return undefined from play(), which the types do not model.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  if (!playPromise || typeof playPromise.then !== "function") return;

  playPromise
    .then(() => setVideoPlaying(true))
    .catch((error: { name?: string } | undefined) => {
      if (error?.name === "AbortError" || videoElement.readyState < 2) {
        return;
      }
      if (error?.name === "NotAllowedError") {
        videoElement.muted = true;
        videoElement
          .play()
          .then(() => setVideoPlaying(true))
          .catch(() => {});
        return;
      }
      setVideoPlaying(false);
    });
}

/**
 * Plays or pauses a video element right away, inside a user gesture, with the configured mute.
 */
export function triggerVideoPlaybackDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextPlaying: boolean,
  configuredMuted: boolean,
): void {
  if (!videoElement) return;
  if (nextPlaying) {
    videoElement.muted = configuredMuted;
    if (!configuredMuted && videoElement.volume === 0) {
      videoElement.volume = DEFAULT_AUDIBLE_VOLUME;
    }
    videoElement.play().catch((err: { name?: string } | undefined) => {
      if (err?.name === "NotAllowedError") {
        videoElement.muted = true;
        videoElement.play().catch(() => {});
      }
    });
  } else {
    videoElement.pause();
  }
}

/**
 * Sets the muted flag on a video element immediately; unmuting restores an audible volume.
 */
export function syncVideoMutedDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextMuted: boolean,
): void {
  if (!videoElement) return;
  videoElement.muted = nextMuted;
  if (!nextMuted && videoElement.volume === 0) {
    videoElement.volume = DEFAULT_AUDIBLE_VOLUME;
  }
}

/**
 * Sets the loop flag on a video element immediately.
 */
export function syncVideoLoopDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextLoop: boolean,
): void {
  if (!videoElement) return;
  videoElement.loop = nextLoop;
}

/** Whether an element is really playing; without one, falls back to the state flag. */
export function isElementPlaying(
  element: HTMLVideoElement | null | undefined,
  fallback: boolean | undefined,
): boolean {
  return element ? !element.paused && !element.ended : Boolean(fallback);
}
