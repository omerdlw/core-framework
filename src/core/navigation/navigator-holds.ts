import { report } from "@/foundation/utils";

import type { getNavigationSettings } from "./settings";
import type {
  NavigationHold,
  NavigationHoldOptions,
  NavigationTrip,
} from "./types";

interface HoldEntry {
  history: boolean;
  hold: NavigationHold;
}

/** Starts every applicable hold and collects the promises of async ones. */
function startHolds(
  holds: Iterable<HoldEntry>,
  trip: NavigationTrip,
  history: boolean,
): Promise<unknown>[] {
  const pending: Promise<unknown>[] = [];
  for (const entry of holds) {
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
  return pending;
}

/** Resolves when all pending holds settle, the trip aborts or the cap passes. */
function waitForHolds(
  pending: Promise<unknown>[],
  trip: NavigationTrip,
  maxHoldMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(cap);
      trip.signal.removeEventListener("abort", done);
      resolve();
    };
    const cap = setTimeout(done, Math.max(0, maxHoldMs));
    trip.signal.addEventListener("abort", done);
    void Promise.all(pending).then(done);
  });
}

export function createNavigationHolds(settings: typeof getNavigationSettings) {
  let nextHoldId = 0;
  const holds = new Map<number, HoldEntry>();

  function runHolds(trip: NavigationTrip, history: boolean): Promise<void> {
    const pending = startHolds(holds.values(), trip, history);
    if (pending.length === 0) return Promise.resolve();
    return waitForHolds(pending, trip, settings().maxHoldMs);
  }

  function hold(
    run: NavigationHold,
    { history = true }: NavigationHoldOptions = {},
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
