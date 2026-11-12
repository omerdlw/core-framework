/** Minimum gap between two forced companion-audio seeks, in milliseconds. */
const AUDIO_SEEK_COOLDOWN_MS = 1500;
const AUDIO_DRIFT_LIMIT = 0.35;
const AUDIO_DRIFT_LIMIT_SILENT = 0.5;
const AUDIO_VOLUME_EPSILON = 0.005;
const AUDIO_MIN_READY_STATE = 2;

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

export function resolveCompanionVolume(volume: unknown) {
  const numeric = Number(volume);
  return Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : 1));
}

/**
 * Mirrors the video element's rate, volume, mute, pause and position onto the
 * companion audio element. `seekClock` remembers when the last seek happened.
 */
export function syncCompanionAudioElements({
  audio,
  forceSeek,
  seekClock,
  video,
}: {
  audio: HTMLAudioElement | null;
  forceSeek: boolean;
  seekClock: { current: number };
  video: HTMLVideoElement | null;
}) {
  if (!video || !audio) return;

  try {
    const targetRate = Number(video.playbackRate) || 1;
    if (audio.playbackRate !== targetRate) audio.playbackRate = targetRate;

    if (
      audio.readyState < AUDIO_MIN_READY_STATE ||
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }

    const volume = resolveCompanionVolume(video.volume);
    if (Math.abs(audio.volume - volume) > AUDIO_VOLUME_EPSILON) {
      audio.volume = volume;
    }

    const isSilent = Boolean(video.muted) || volume === 0;
    if (audio.muted !== isSilent) audio.muted = isSilent;

    if (video.paused || video.ended || video.seeking) {
      if (!audio.paused) audio.pause();
      return;
    }

    const now = performance.now();
    const drift = Math.abs(audio.currentTime - video.currentTime);
    const maxDrift = isSilent ? AUDIO_DRIFT_LIMIT_SILENT : AUDIO_DRIFT_LIMIT;
    if (
      forceSeek ||
      (drift > maxDrift && now - seekClock.current > AUDIO_SEEK_COOLDOWN_MS)
    ) {
      seekClock.current = now;
      audio.currentTime = video.currentTime;
    }

    if (audio.paused) audio.play().catch(() => {});
  } catch {}
}
