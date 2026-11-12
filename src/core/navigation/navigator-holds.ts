import { report } from "@/foundation/utils";
import type { NavigationHold, NavigationTrip } from "./types";
import type { getNavigationSettings } from "./settings";

export function createNavigationHolds(settings: typeof getNavigationSettings) {
  let nextHoldId = 0;
  const holds = new Map<number, { history: boolean; hold: NavigationHold }>();

  function runHolds(trip: NavigationTrip, history: boolean): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const entry of holds.values()) {
      if (history && !entry.history) continue;
      try {
        const result = entry.hold(trip);
        if (result && typeof result.then === "function")
          pending.push(
            Promise.resolve(result).catch((error) =>
              report("Navigation hold", error),
            ),
          );
      } catch (error) {
        report("Navigation hold", error);
      }
    }
    if (pending.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(cap);
        trip.signal.removeEventListener("abort", done);
        resolve();
      };
      const cap = setTimeout(done, Math.max(0, settings().maxHoldMs));
      trip.signal.addEventListener("abort", done);
      void Promise.all(pending).then(done);
    });
  }

  function hold(
    run: NavigationHold,
    { history = true }: { history?: boolean } = {},
  ): () => void {
    const id = ++nextHoldId;
    holds.set(id, { history, hold: run });
    return () => {
      holds.delete(id);
    };
  }
  function holdsHistory(): boolean {
    for (const entry of holds.values()) if (entry.history) return true;
    return false;
  }

  return { hold, holdsHistory, runHolds };
}
