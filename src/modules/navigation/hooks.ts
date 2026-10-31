"use client";

import { useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useIsomorphicLayoutEffect, useRequiredContext, useStore } from "@/hooks";
import {
  INERT_NAVIGATION_ACTIONS,
  NOOP_NAVIGATION_STORE,
  NavigationContext,
} from "./context";
import { tripDestination } from "./state";
import type {
  NavigationActions,
  NavigationHold,
  NavigationHoldOptions,
  NavigationIntentListener,
  NavigationPayloadKey,
  NavigationPayloadValue,
  NavigationState,
  NavigationTrip,
} from "./types";
import { isSamePathname } from "./utils";

/** The navigator's actions. Throws outside `NavigationProvider`. */
export function useNavigation(): NavigationActions {
  return useRequiredContext(
    NavigationContext,
    "useNavigation",
    "NavigationProvider",
  ).actions;
}

/** The navigator's actions, or inert ones when the module is not installed. */
export function useOptionalNavigation(): NavigationActions {
  return useContext(NavigationContext)?.actions ?? INERT_NAVIGATION_ACTIONS;
}

export function useNavigationState(): NavigationState;
export function useNavigationState<T>(
  selector: (state: NavigationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useNavigationState<T = NavigationState>(
  selector?: (state: NavigationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const store = useContext(NavigationContext)?.store ?? NOOP_NAVIGATION_STORE;
  return useStore(
    store,
    selector as (state: NavigationState) => T,
    isEqual,
  );
}

/** The latest value of `value`, readable from callbacks registered once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * Holds every trip leaving while this component is mounted, until the
 * returned promise settles (capped by `maxHoldMs`). Pass `false` or `null`
 * to hold nothing. Watch `trip.signal` to undo an exit that never lands.
 */
export function useNavigationHold(
  hold: NavigationHold | false | null | undefined,
  { history = true }: NavigationHoldOptions = {},
): void {
  const { hold: register } = useOptionalNavigation();
  const latest = useLatest(hold);
  const enabled = Boolean(hold);
  useEffect(() => {
    if (!enabled) return;
    return register((trip) => {
      const run = latest.current;
      return run ? run(trip) : undefined;
    }, { history });
  }, [enabled, history, latest, register]);
}

/**
 * Adds `key` to the payload of every trip leaving while this component is
 * mounted. A function is called when the trip starts.
 */
export function useNavigationPayload<K extends NavigationPayloadKey>(
  key: K,
  value: NavigationPayloadValue<K>,
): void {
  const { provide } = useOptionalNavigation();
  const latest = useLatest(value);
  useEffect(
    () =>
      provide(key, (() => {
        const current = latest.current;
        return typeof current === "function"
          ? (current as () => unknown)()
          : current;
      }) as NavigationPayloadValue<K>),
    [key, latest, provide],
  );
}

/** Called with each path the navigator warms, from links, the dock or code. */
export function useNavigationIntent(listener: NavigationIntentListener): void {
  const { onIntent } = useOptionalNavigation();
  const latest = useLatest(listener);
  useEffect(
    () => onIntent((path, href) => latest.current(path, href)),
    [latest, onIntent],
  );
}

/** The trip leaving the current page, while it is under way. */
export function useDeparture(): NavigationTrip | null {
  const pathname = usePathname();
  const active = useNavigationState((state) => state.active);
  return active && !isSamePathname(tripDestination(active), pathname)
    ? active
    : null;
}

/**
 * The trip that brought the page to `pathname` (default: the current one),
 * from the moment the router is asked for it until `arrivalTtlMs` later or
 * until the page is left. A route's `loading.tsx` reads it too.
 */
export function useArrival(pathname?: string): NavigationTrip | null {
  const routePathname = usePathname();
  const target = pathname ?? routePathname;
  const { arrival } = useOptionalNavigation();
  return useNavigationState(() => arrival(target));
}
