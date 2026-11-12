import { NAVIGATION_PHASE, NAVIGATION_STATUS } from "./constants";
import type {
  NavigationPayload,
  NavigationState,
  NavigationStatus,
  NavigationTrip,
} from "./types";
import { isSameLocation, locationKeyOf } from "./utils";

export function createNavigationState(location = ""): NavigationState {
  return { active: null, last: null, location };
}

interface TripInit {
  from: string;
  href: string;
  id: number;
  payload?: NavigationPayload;
  signal: AbortSignal;
  source: string;
  startedAt: number;
}

interface SettleInit {
  arrivedAt?: string;
  endedAt: number;
  error?: unknown;
  reason?: string | null;
}

export type SettleDetails = Omit<SettleInit, "endedAt">;

export function createTrip({
  from,
  href,
  id,
  payload = {},
  signal,
  source,
  startedAt,
}: TripInit): NavigationTrip {
  return {
    from,
    href,
    id,
    payload,
    phase: NAVIGATION_PHASE.LEAVING,
    signal,
    source,
    startedAt,
    status: NAVIGATION_STATUS.PENDING,
    to: locationKeyOf(href),
  };
}

export function settleTrip(
  trip: NavigationTrip,
  status: NavigationStatus,
  { arrivedAt, endedAt, error = null, reason = null }: SettleInit,
): NavigationTrip {
  const settled: NavigationTrip = { ...trip, endedAt, error, reason, status };
  if (arrivedAt && arrivedAt !== trip.to) settled.arrivedAt = arrivedAt;
  return settled;
}

export type ArrivalVerdict = "complete" | "cancel" | "ignore";

/** Decides what arriving at `key` means for the active trip. */
export function judgeArrival(
  trip: NavigationTrip,
  key: string,
): ArrivalVerdict {
  if (trip.phase === NAVIGATION_PHASE.ROUTING) {
    const stillOnOrigin =
      isSameLocation(key, trip.from) && !isSameLocation(key, trip.to);
    return stillOnOrigin ? "ignore" : "complete";
  }
  if (isSameLocation(key, trip.to)) return "complete";
  if (!isSameLocation(key, trip.from)) return "cancel";
  return "ignore";
}

export const tripDestination = (trip: NavigationTrip): string =>
  trip.arrivedAt ?? trip.to;
