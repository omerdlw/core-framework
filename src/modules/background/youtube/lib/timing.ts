/** Schedules a guarded retry and tracks its timer id so it can be cancelled. */
export function scheduleRetryTimer(
  timerIds: Set<number>,
  callback: () => void,
  delay: number,
) {
  const timerId = window.setTimeout(() => {
    timerIds.delete(timerId);
    try {
      callback();
    } catch {}
  }, delay);
  timerIds.add(timerId);
}

/** Playback position (seconds) at which a video should end, or 0 for "never". */
export function resolveEffectiveEnd(
  endTime: number,
  corp: number,
  duration: number,
) {
  if (endTime > 0) return endTime;
  if (corp > 0 && duration > 0) return duration - corp;
  return 0;
}

/** Smallest distance from the end at which the iframe player is stopped, in seconds. */
const IFRAME_MIN_END_MARGIN = 0.4;

/** Like `resolveEffectiveEnd`, but for the iframe player, which needs a margin. */
export function resolveIframeSafetyEnd(
  endTime: number,
  corp: number,
  duration: number,
) {
  if (endTime > 0) return endTime;
  if (duration > 0) return duration - Math.max(corp, IFRAME_MIN_END_MARGIN);
  return 0;
}

/** Whether playback reached the effective end (explicit end time or cropped tail). */
export function hasPassedEnd(
  currentTime: number,
  endTime: number,
  corp: number,
  duration: number,
) {
  const effectiveEnd = resolveEffectiveEnd(endTime, corp, duration);
  return effectiveEnd > 0 && currentTime >= effectiveEnd;
}

/** Whether a native video is within `corp` seconds of its end. */
export function isWithinCorp(
  currentTime: number,
  duration: number | undefined,
  corp: number,
) {
  if (!duration) return false;
  return corp > 0 && currentTime >= duration - corp;
}
