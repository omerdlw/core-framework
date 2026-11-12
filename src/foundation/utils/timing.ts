const DEFAULT_WAIT_MS = 300;

/**
 * Delays calls until `wait` ms pass without a new one. The result has `cancel()`.
 */
export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait = DEFAULT_WAIT_MS,
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
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  return debounced;
}

/**
 * Runs at most once per `limit` ms, with a trailing call. The result has `cancel()`.
 */
export function throttle<T extends (...args: never[]) => void>(
  func: T,
  limit = DEFAULT_WAIT_MS,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastRan = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const throttled: ((...args: Parameters<T>) => void) & {
    cancel: () => void;
  } = function (...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastRan >= limit) {
      lastRan = now;
      func(...args);
    } else if (timerId === null) {
      timerId = setTimeout(
        () => {
          lastRan = Date.now();
          timerId = null;
          func(...args);
        },
        limit - (now - lastRan),
      );
    }
  };
  throttled.cancel = () => {
    if (timerId === null) return;
    clearTimeout(timerId);
    timerId = null;
  };
  return throttled;
}
