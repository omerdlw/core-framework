import { normalizePath } from "@/foundation/utils";

import {
  DOCK_CONTINUITY_EVENTS,
  DOCK_CONTINUITY_MAX_ENTRIES,
  DOCK_SURFACE_RETURN_MAX_ENTRIES,
} from "../../constants";
import { isSafeInternalHref } from "../../model/paths";
import type {
  DockContinuityAction,
  DockContinuityEntry,
  DockContinuityState,
  DockReturnHandoff,
} from "../../types";

function normalizeContinuitySnapshot(
  snapshot: unknown,
): Record<string, unknown> {
  if (
    snapshot == null ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  )
    return {};
  return { ...snapshot };
}

export function createDockContinuityState(): DockContinuityState {
  return { entries: [], returnHandoffs: [] };
}

function normalizeDockReturnValue(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value ?? null;
  if (Array.isArray(value)) return [...(value as unknown[])];
  return { ...value };
}

let dockReturnHandoffSequence = 0;

export function createDockReturnHandoff({
  data = null,
  flowId = null,
  pathname = "",
  status = null,
  timestamp = Date.now(),
}: {
  data?: unknown;
  flowId?: string | null;
  pathname?: string;
  status?: string | null;
  timestamp?: number;
} = {}): DockReturnHandoff | null {
  if (!isSafeInternalHref(pathname)) return null;
  const path = normalizePath(pathname || "");
  if (!path) return null;

  const resolvedTimestamp = Number.isFinite(Number(timestamp))
    ? Number(timestamp)
    : Date.now();
  return {
    data: normalizeDockReturnValue(data),
    flowId: typeof flowId === "string" && flowId ? flowId : null,
    id: `${typeof flowId === "string" && flowId ? flowId : "surface-flow"}:${resolvedTimestamp}:${++dockReturnHandoffSequence}`,
    path,
    status: typeof status === "string" && status ? status : null,
    timestamp: resolvedTimestamp,
  };
}

export function createDockContinuityEntry({
  focusKey = null,
  pathname = "",
  scrollY = 0,
  snapshot = null,
  updatedAt = Date.now(),
}: {
  focusKey?: string | null;
  pathname?: string;
  scrollY?: number;
  snapshot?: unknown;
  updatedAt?: number;
} = {}): DockContinuityEntry | null {
  const path = normalizePath(pathname || "");
  if (!path) return null;

  const numericScrollY = Number(scrollY);
  return {
    focusKey: typeof focusKey === "string" && focusKey ? focusKey : null,
    path,
    scrollY: Number.isFinite(numericScrollY) ? Math.max(0, numericScrollY) : 0,
    snapshot: normalizeContinuitySnapshot(snapshot),
    updatedAt: Number.isFinite(Number(updatedAt))
      ? Number(updatedAt)
      : Date.now(),
  };
}

function clearContinuity(
  currentState: DockContinuityState,
  returnHandoffs: DockReturnHandoff[],
): DockContinuityState {
  return currentState.entries.length || returnHandoffs.length
    ? createDockContinuityState()
    : currentState;
}

function deliverReturnHandoff(
  currentState: DockContinuityState,
  returnHandoffs: DockReturnHandoff[],
  action: DockContinuityAction,
): DockContinuityState {
  const handoff = action.handoff;
  if (!handoff?.id || !handoff.path) return currentState;
  const maxEntries = Math.max(
    1,
    Number(action.maxEntries) || DOCK_SURFACE_RETURN_MAX_ENTRIES,
  );

  const filteredHandoffs = returnHandoffs.filter(
    (entry) => entry.id !== handoff.id,
  );
  filteredHandoffs.push(handoff);
  if (filteredHandoffs.length > maxEntries)
    filteredHandoffs.splice(0, filteredHandoffs.length - maxEntries);

  return { ...currentState, returnHandoffs: filteredHandoffs };
}

function consumeReturnHandoff(
  currentState: DockContinuityState,
  returnHandoffs: DockReturnHandoff[],
  action: DockContinuityAction,
): DockContinuityState {
  const handoffId =
    typeof action.handoffId === "string" ? action.handoffId : "";
  if (!handoffId) return currentState;

  const nextReturnHandoffs = returnHandoffs.filter(
    (entry) => entry.id !== handoffId,
  );
  return nextReturnHandoffs.length === returnHandoffs.length
    ? currentState
    : { ...currentState, returnHandoffs: nextReturnHandoffs };
}

function removeContinuityEntry(
  currentState: DockContinuityState,
  action: DockContinuityAction,
): DockContinuityState {
  const path = normalizePath(action.path || "");
  const entries = currentState.entries.filter((entry) => entry.path !== path);
  return entries.length === currentState.entries.length
    ? currentState
    : { ...currentState, entries };
}

function recordContinuityEntry(
  currentState: DockContinuityState,
  action: DockContinuityAction,
): DockContinuityState {
  const recordedEntry = action.entry;
  if (!recordedEntry?.path) return currentState;

  const maxEntries = Math.max(
    1,
    Number(action.maxEntries) || DOCK_CONTINUITY_MAX_ENTRIES,
  );

  const nextEntries = currentState.entries.filter(
    (entry) => entry.path !== recordedEntry.path,
  );
  nextEntries.push(recordedEntry);
  if (nextEntries.length > maxEntries)
    nextEntries.splice(0, nextEntries.length - maxEntries);

  return { ...currentState, entries: nextEntries };
}

/** Reducer for the continuity state: entries per path and return handoffs. */
export function dockContinuityReducer(
  state: DockContinuityState | null | undefined,
  action: DockContinuityAction | null | undefined,
): DockContinuityState {
  const currentState = state || createDockContinuityState();
  const returnHandoffs = Array.isArray(currentState.returnHandoffs)
    ? currentState.returnHandoffs
    : [];

  switch (action?.type) {
    case DOCK_CONTINUITY_EVENTS.CLEAR:
      return clearContinuity(currentState, returnHandoffs);
    case DOCK_CONTINUITY_EVENTS.DELIVER_RETURN:
      return deliverReturnHandoff(currentState, returnHandoffs, action);
    case DOCK_CONTINUITY_EVENTS.CONSUME_RETURN:
      return consumeReturnHandoff(currentState, returnHandoffs, action);
    case DOCK_CONTINUITY_EVENTS.REMOVE:
      return removeContinuityEntry(currentState, action);
    case DOCK_CONTINUITY_EVENTS.RECORD:
      return recordContinuityEntry(currentState, action);
    default:
      return currentState;
  }
}

export function resolveDockContinuityEntry(
  state: DockContinuityState | null | undefined,
  pathname: string,
): DockContinuityEntry | null {
  const path = normalizePath(pathname || "");
  return state?.entries?.find((entry) => entry.path === path) || null;
}

export function resolveDockReturnHandoffs(
  state: DockContinuityState | null | undefined,
  pathname: string,
): DockReturnHandoff[] {
  const path = normalizePath(pathname || "");
  if (!path) return [];
  return (state?.returnHandoffs || []).filter(
    (handoff) => handoff.path === path,
  );
}
