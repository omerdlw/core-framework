"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { normalizePath } from "@/utils";
import {
  DOCK_CONTINUITY_EVENTS,
  DOCK_CONTINUITY_MAX_ENTRIES,
  DOCK_SURFACE_RETURN_MAX_ENTRIES,
} from "../constants";
import { isSafeInternalHref } from "../utils";
import {
  type DockContinuityAction,
  type DockContinuityEntry,
  type DockContinuityRememberOptions,
  type DockContinuityState,
  type DockReturnHandoff,
  type DockReturnHandoffInput,
} from "../types";

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

function createDockContinuityState(): DockContinuityState {
  return { entries: [], returnHandoffs: [] };
}

function normalizeDockReturnValue(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value ?? null;
  if (Array.isArray(value)) return [...value];
  return { ...value };
}

let dockReturnHandoffSequence = 0;

function createDockReturnHandoff({
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

function createDockContinuityEntry({
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

function dockContinuityReducer(
  state: DockContinuityState | null | undefined,
  action: DockContinuityAction | null | undefined,
): DockContinuityState {
  const currentState = state || createDockContinuityState();
  const returnHandoffs = Array.isArray(currentState.returnHandoffs)
    ? currentState.returnHandoffs
    : [];

  if (action?.type === DOCK_CONTINUITY_EVENTS.CLEAR) {
    return currentState.entries.length || returnHandoffs.length
      ? createDockContinuityState()
      : currentState;
  }

  if (action?.type === DOCK_CONTINUITY_EVENTS.DELIVER_RETURN) {
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

  if (action?.type === DOCK_CONTINUITY_EVENTS.CONSUME_RETURN) {
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

  if (action?.type === DOCK_CONTINUITY_EVENTS.REMOVE) {
    const path = normalizePath(action.path || "");
    const entries = currentState.entries.filter((entry) => entry.path !== path);
    return entries.length === currentState.entries.length
      ? currentState
      : { ...currentState, entries };
  }

  const recordedEntry = action?.entry;
  if (action?.type !== DOCK_CONTINUITY_EVENTS.RECORD || !recordedEntry?.path) {
    return currentState;
  }

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

function resolveDockContinuityEntry(
  state: DockContinuityState | null | undefined,
  pathname: string,
): DockContinuityEntry | null {
  const path = normalizePath(pathname || "");
  return state?.entries?.find((entry) => entry.path === path) || null;
}

function resolveDockReturnHandoffs(
  state: DockContinuityState | null | undefined,
  pathname: string,
): DockReturnHandoff[] {
  const path = normalizePath(pathname || "");
  if (!path) return [];
  return (state?.returnHandoffs || []).filter(
    (handoff) => handoff.path === path,
  );
}

export function useDockContinuity({
  maxEntries = DOCK_CONTINUITY_MAX_ENTRIES,
}: {
  maxEntries?: number;
} = {}) {
  const [state, dispatch] = useReducer(
    dockContinuityReducer,
    undefined,
    createDockContinuityState,
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const remember = useCallback(
    (pathname: string, options: DockContinuityRememberOptions = {}) => {
      const entry = createDockContinuityEntry({
        pathname,
        scrollY:
          options.scrollY ??
          (typeof window === "undefined" ? 0 : window.scrollY),
        ...options,
      });
      if (!entry) return null;
      dispatch({
        entry,
        maxEntries,
        type: DOCK_CONTINUITY_EVENTS.RECORD,
      });
      return entry;
    },
    [maxEntries],
  );

  const remove = useCallback(
    (pathname: string) =>
      dispatch({ path: pathname, type: DOCK_CONTINUITY_EVENTS.REMOVE }),
    [],
  );
  const clear = useCallback(
    () => dispatch({ type: DOCK_CONTINUITY_EVENTS.CLEAR }),
    [],
  );
  const get = useCallback(
    (pathname: string) =>
      resolveDockContinuityEntry(stateRef.current, pathname),
    [],
  );

  const deliverReturn = useCallback(
    (pathname: string, input: DockReturnHandoffInput = {}) => {
      const handoff = createDockReturnHandoff({ pathname, ...input });
      if (!handoff) return null;
      dispatch({
        handoff,
        maxEntries: DOCK_SURFACE_RETURN_MAX_ENTRIES,
        type: DOCK_CONTINUITY_EVENTS.DELIVER_RETURN,
      });
      return handoff;
    },
    [],
  );

  const getReturns = useCallback(
    (pathname: string) => resolveDockReturnHandoffs(stateRef.current, pathname),
    [],
  );

  const consumeReturn = useCallback(
    (pathname: string, handoffId: string | null = null) => {
      const handoffs = resolveDockReturnHandoffs(stateRef.current, pathname);
      const handoff = handoffId
        ? handoffs.find((entry) => entry.id === handoffId) || null
        : handoffs[0] || null;
      if (!handoff) return null;

      dispatch({
        handoffId: handoff.id,
        type: DOCK_CONTINUITY_EVENTS.CONSUME_RETURN,
      });
      return handoff;
    },
    [],
  );

  const restore = useCallback(
    (
      pathname: string,
      {
        focusKey = null,
        restoreScroll = true,
      }: { focusKey?: string | null; restoreScroll?: boolean } = {},
    ) => {
      const entry = resolveDockContinuityEntry(stateRef.current, pathname);
      if (typeof window === "undefined") return entry;

      const targetFocusKey = focusKey || entry?.focusKey;

      requestAnimationFrame(() => {
        if (restoreScroll && entry)
          window.scrollTo({ top: entry.scrollY, behavior: "auto" });

        if (!targetFocusKey || typeof document === "undefined") return;

        const safeKey =
          typeof CSS !== "undefined" && CSS.escape
            ? CSS.escape(targetFocusKey)
            : targetFocusKey.replace(/"/g, '\\"');
        const target = document.querySelector(
          `[data-dock-focus-key="${safeKey}"]`,
        ) as HTMLElement | null;

        if (!target || typeof target.focus !== "function") return;
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
      });

      return entry;
    },
    [],
  );

  return useMemo(
    () => ({
      clear,
      consumeReturn,
      deliverReturn,
      entries: state.entries,
      get,
      getReturns,
      remember,
      remove,
      restore,
      returnHandoffs: state.returnHandoffs,
    }),
    [
      clear,
      consumeReturn,
      deliverReturn,
      get,
      getReturns,
      remember,
      remove,
      restore,
      state.entries,
      state.returnHandoffs,
    ],
  );
}
