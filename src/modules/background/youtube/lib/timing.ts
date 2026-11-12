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
