const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_THROTTLE_MS = 300;

/**
 * Delays calls until `wait` ms pass without a new one. The result has `cancel()`.
 */
export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait = DEFAULT_DEBOUNCE_MS,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func(...args);
    }, wait);
  }
  debounced.cancel = () => {
    if (timeoutId === null) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced;
}

/**
 * Runs at most once per `limit` ms, with a trailing call. The result has `cancel()`.
 */
export function throttle<T extends (...args: never[]) => void>(
  func: T,
  limit = DEFAULT_THROTTLE_MS,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastRan = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  function throttled(...args: Parameters<T>): void {
    const elapsed = Date.now() - lastRan;
    if (elapsed >= limit) {
      lastRan = Date.now();
      func(...args);
      return;
    }
    if (timerId !== null) return;
    timerId = setTimeout(() => {
      lastRan = Date.now();
      timerId = null;
      func(...args);
    }, limit - elapsed);
  }
  throttled.cancel = () => {
    if (timerId === null) return;
    clearTimeout(timerId);
    timerId = null;
  };
  return throttled;
}
