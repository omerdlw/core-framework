import type { Timer } from "./navigator-defaults";
import type { getNavigationSettings } from "./settings";

interface PatienceTimerOptions {
  onTimeout: (id: number) => void;
  settings: typeof getNavigationSettings;
}

/**
 * A single timeout for the active trip. Starting it again replaces the
 * previous one; it calls `onTimeout` with the trip id when time runs out.
 */
export function createPatienceTimer({
  onTimeout,
  settings,
}: PatienceTimerOptions) {
  let patience: Timer | null = null;

  function clear(): void {
    if (patience === null) return;
    clearTimeout(patience);
    patience = null;
  }

  function start(id: number): void {
    clear();
    const ms = Number(settings().timeoutMs);
    if (!Number.isFinite(ms) || ms <= 0) return;
    patience = setTimeout(() => {
      patience = null;
      onTimeout(id);
    }, ms);
  }

  return { clear, start };
}
