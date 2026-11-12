import type { StatusState } from "../types";
import type { StatusUpdate } from "./model";
import {
  isEquivalentOverlayStatus,
  isErrorStatus,
  resolveStatusPriority,
} from "./model";

const ACCOUNT_DELETE_STATUS_TYPE = "ACCOUNT_DELETE";

/**
 * Applies a status update: identical statuses are ignored and a lower
 * priority status never replaces a higher priority one.
 */
export function resolveUpdatedStatus(
  currentStatus: StatusState,
  nextStatusOrFn: StatusUpdate,
): StatusState {
  const nextStatus =
    typeof nextStatusOrFn === "function"
      ? nextStatusOrFn(currentStatus)
      : nextStatusOrFn;
  if (!nextStatus) return null;
  if (isEquivalentOverlayStatus(currentStatus, nextStatus))
    return currentStatus;
  if (!currentStatus) return nextStatus;
  return resolveStatusPriority(nextStatus) >=
    resolveStatusPriority(currentStatus)
    ? nextStatus
    : currentStatus;
}

/** Clears the status when its type is in `clearTypes` (or the list is empty). */
export function resolveExpiredStatus(
  currentStatus: StatusState,
  clearTypes: string[],
): StatusState {
  if (!currentStatus) return currentStatus;
  if (clearTypes.length === 0 || clearTypes.includes(currentStatus.type))
    return null;
  return currentStatus;
}

/** True for error statuses that a route change dismisses. */
export function isClearedByRouteChange(currentStatus: StatusState): boolean {
  return Boolean(
    currentStatus &&
    isErrorStatus(currentStatus.type) &&
    currentStatus.type !== ACCOUNT_DELETE_STATUS_TYPE,
  );
}
