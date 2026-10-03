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

export function triggerVideoPlaybackDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextPlaying: boolean,
  configuredMuted: boolean,
): void {
  if (!videoElement) return;
  if (nextPlaying) {
    videoElement.muted = configuredMuted;
    if (!configuredMuted && videoElement.volume === 0) {
      videoElement.volume = 0.8;
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

export function syncVideoMutedDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextMuted: boolean,
): void {
  if (!videoElement) return;
  videoElement.muted = nextMuted;
  if (!nextMuted && videoElement.volume === 0) {
    videoElement.volume = 0.8;
  }
}

export function syncVideoLoopDirect(
  videoElement: HTMLVideoElement | null | undefined,
  nextLoop: boolean,
): void {
  if (!videoElement) return;
  videoElement.loop = nextLoop;
}
