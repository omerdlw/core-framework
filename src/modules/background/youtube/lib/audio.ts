export const AUDIO_SYNC_EVENTS = [
  "play",
  "playing",
  "pause",
  "waiting",
  "volumechange",
  "ratechange",
] as const;

export function setElementMuted(video: HTMLVideoElement, muted: boolean) {
  video.muted = muted;
  if (!muted && video.volume === 0) video.volume = 0.8;
}

export function unlockAudioOnGesture(unlock: () => void) {
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}
