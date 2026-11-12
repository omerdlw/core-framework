import { PLAYBACK_RATES } from "../constants";

/** Seconds jumped by the skip-back and skip-forward controls. */
export const MEDIA_SKIP_SECONDS = 10;
/** Volume change per arrow-key press on the volume slider. */
export const VOLUME_KEY_STEP = 0.05;
/** Volume restored when unmuting from a volume of zero. */
export const RESTORED_VOLUME = 0.7;
const PERCENT = 100;

/** Formats a 0..1 fraction as a CSS percentage string. */
export function toPercentString(fraction: number): string {
  return `${fraction * PERCENT}%`;
}

/** Rounds a 0..1 fraction to two decimals, the precision volume is stored at. */
export function roundVolume(fraction: number): number {
  return Math.round(fraction * PERCENT) / PERCENT;
}

/** The playback rate that follows the current one, wrapping around. */
export function getNextPlaybackRate(current: number): number {
  const currentIndex = (PLAYBACK_RATES as readonly number[]).indexOf(current);
  return PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
}

/** Playback rate reported by an element, or 1 when it is not a positive number. */
export function normalizePlaybackRate(rate: unknown): number {
  const nextRate = Number(rate);
  return Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1;
}

/** Time after skipping forward, capped at the duration when it is known. */
export function getSkipForwardTime(current: number, duration: number): number {
  return duration > 0
    ? Math.min(duration, current + MEDIA_SKIP_SECONDS)
    : current + MEDIA_SKIP_SECONDS;
}

/** Seconds moved by the arrow keys on the scrubber. */
export const SCRUBBER_KEY_STEP_SECONDS = 5;

/** Playback progress as a 0..1 ratio, 0 while the duration is unknown. */
export function getProgressRatio(current: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
}

/** Pointer offset inside a track and its 0..1 fraction of the track width. */
export function getTrackPosition(
  clientX: number,
  rect: { left: number; width: number },
): { offsetX: number; fraction: number } {
  const offsetX = Math.min(rect.width, Math.max(0, clientX - rect.left));
  return { offsetX, fraction: rect.width > 0 ? offsetX / rect.width : 0 };
}
