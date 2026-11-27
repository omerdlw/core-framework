"use client";

import { type Dispatch, useEffect, useReducer, useState } from "react";

import {
  DOCK_CONTINUITY_EVENTS,
  DOCK_CONTINUITY_MAX_ENTRIES,
  DOCK_SURFACE_RETURN_MAX_ENTRIES,
} from "../constants";
import type {
  DockContinuityAction,
  DockContinuityEntry,
  DockContinuityRememberOptions,
  DockContinuityState,
  DockReturnHandoffInput,
} from "../types";
import {
  createDockContinuityEntry,
  createDockContinuityState,
  createDockReturnHandoff,
  dockContinuityReducer,
  resolveDockContinuityEntry,
  resolveDockReturnHandoffs,
} from "./continuity-state";

function createContinuityActions(
  dispatch: Dispatch<DockContinuityAction>,
  initial: { maxEntries: number; state: DockContinuityState },
) {
  let { maxEntries, state } = initial;

  const actions = {
    clear: () => dispatch({ type: DOCK_CONTINUITY_EVENTS.CLEAR }),
    consumeReturn: (pathname: string, handoffId: string | null = null) => {
      const handoffs = resolveDockReturnHandoffs(state, pathname);
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
    deliverReturn: (pathname: string, input: DockReturnHandoffInput = {}) => {
      const handoff = createDockReturnHandoff({ pathname, ...input });
      if (!handoff) return null;
      dispatch({
        handoff,
        maxEntries: DOCK_SURFACE_RETURN_MAX_ENTRIES,
        type: DOCK_CONTINUITY_EVENTS.DELIVER_RETURN,
      });
      return handoff;
    },
    get: (pathname: string) => resolveDockContinuityEntry(state, pathname),
    getReturns: (pathname: string) =>
      resolveDockReturnHandoffs(state, pathname),
    remember: (
      pathname: string,
      options: DockContinuityRememberOptions = {},
    ) => {
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
    remove: (pathname: string) =>
      dispatch({ path: pathname, type: DOCK_CONTINUITY_EVENTS.REMOVE }),
    restore: (
      pathname: string,
      {
        focusKey = null,
        restoreScroll = true,
      }: { focusKey?: string | null; restoreScroll?: boolean } = {},
    ) => {
      const entry = resolveDockContinuityEntry(state, pathname);
      if (typeof window === "undefined") return entry;

      restoreContinuityView(entry, focusKey, restoreScroll);

      return entry;
    },
  };

  return {
    actions,
    sync: (next: { maxEntries: number; state: DockContinuityState }) => {
      ({ maxEntries, state } = next);
    },
  };
}

/** The continuity actions; built once per provider, so their identity is stable. */
export type DockContinuityActions = ReturnType<
  typeof createContinuityActions
>["actions"];

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
  const [{ actions, sync }] = useState(() =>
    createContinuityActions(dispatch, { maxEntries, state }),
  );

  useEffect(() => {
    sync({ maxEntries, state });
  }, [maxEntries, state, sync]);

  return {
    actions,
    entries: state.entries,
    returnHandoffs: state.returnHandoffs,
  };
}

const FOCUS_KEY_ATTRIBUTE = "data-dock-focus-key";

function escapeFocusKey(key: string) {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(key)
    : key.replace(/"/g, '\\"');
}

/**
 * On the next frame, restores the saved scroll position and focuses the
 * element tagged with the entry's (or the given) focus key.
 */
function restoreContinuityView(
  entry: DockContinuityEntry | null,
  focusKey: string | null,
  restoreScroll: boolean,
) {
  const targetFocusKey = focusKey || entry?.focusKey;

  requestAnimationFrame(() => {
    if (restoreScroll && entry)
      window.scrollTo({ top: entry.scrollY, behavior: "auto" });

    if (!targetFocusKey || typeof document === "undefined") return;

    const target = document.querySelector<HTMLElement>(
      `[${FOCUS_KEY_ATTRIBUTE}="${escapeFocusKey(targetFocusKey)}"]`,
    );

    if (!target || typeof target.focus !== "function") return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  });
}
