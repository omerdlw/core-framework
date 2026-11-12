import type { NavigationPhase, NavigationStatus } from "./types";

/**
 * Values of NavigationTrip.status.
 */
export const NAVIGATION_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
  TIMED_OUT: "timed-out",
} as const satisfies Record<string, NavigationStatus>);

/**
 * Values of NavigationTrip.phase.
 */
export const NAVIGATION_PHASE = Object.freeze({
  LEAVING: "leaving",
  ROUTING: "routing",
} as const satisfies Record<string, NavigationPhase>);

/**
 * Reasons recorded when a trip is cancelled or times out.
 */
export const NAVIGATION_REASON = Object.freeze({
  GUARD: "guard",
  RETURNED: "returned",
  SUPERSEDED: "superseded",
  TIME_OUT: "time-out",
} as const);

/**
 * Where a trip originated: an explicit navigate() call or browser history.
 */
export const NAVIGATION_SOURCE = Object.freeze({
  HISTORY: "history",
  NAVIGATE: "navigate",
} as const);

/**
 * Names of the global events emitted as a trip starts, commits and ends.
 */
export const NAVIGATION_EVENTS = Object.freeze({
  START: "NAVIGATION_START",
  COMMIT: "NAVIGATION_COMMIT",
  END: "NAVIGATION_END",
} as const);

export const NAVIGATION_INTENT_DELAY_MS = 180;
export const NAVIGATION_PREFETCH_TTL_MS = 4 * 60_000;
export const NAVIGATION_ARRIVAL_TTL_MS = 20_000;
export const NAVIGATION_MAX_HOLD_MS = 5_000;
export const NAVIGATION_TIMEOUT_MS = 15_000;

export const NAVIGATION_PREFETCH_ATTRIBUTE = "data-prefetch";
