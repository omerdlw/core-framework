import { NAVIGATION_PHASE, NAVIGATION_STATUS } from "./constants";
import type {
  NavigationPayload,
  NavigationState,
  NavigationStatus,
  NavigationTrip,
} from "./types";
import { locationKeyOf } from "./utils";

export function createNavigationState(location = ""): NavigationState {
  return { active: null, last: null, location };
}

export function createTrip({
  from,
  href,
  id,
  payload = {},
  signal,
  source,
  startedAt,
}: {
  from: string;
  href: string;
  id: number;
  payload?: NavigationPayload;
  signal: AbortSignal;
  source: string;
  startedAt: number;
}): NavigationTrip {
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
  {
    arrivedAt,
    endedAt,
    error = null,
    reason = null,
  }: {
    arrivedAt?: string;
    endedAt: number;
    error?: unknown;
    reason?: string | null;
  },
): NavigationTrip {
  const settled: NavigationTrip = { ...trip, endedAt, error, reason, status };
  if (arrivedAt && arrivedAt !== trip.to) settled.arrivedAt = arrivedAt;
  return settled;
}

export const tripDestination = (trip: NavigationTrip): string =>
  trip.arrivedAt ?? trip.to;
