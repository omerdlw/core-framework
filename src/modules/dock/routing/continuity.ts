"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  DOCK_CONTINUITY_EVENTS,
  DOCK_CONTINUITY_MAX_ENTRIES,
  DOCK_SURFACE_RETURN_MAX_ENTRIES,
} from "../constants";
import type {
  DockContinuityRememberOptions,
  DockReturnHandoffInput,
} from "../types";
import { restoreContinuityView } from "./lib/restore";
import {
  createDockContinuityEntry,
  createDockContinuityState,
  createDockReturnHandoff,
  dockContinuityReducer,
  resolveDockContinuityEntry,
  resolveDockReturnHandoffs,
} from "./model/continuity";

/**
 * Remembers scroll position, focus and snapshots per path, and hands results
 * back to a route a surface flow returns to. Internal to the dock provider.
 */
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

      restoreContinuityView(entry, focusKey, restoreScroll);

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
