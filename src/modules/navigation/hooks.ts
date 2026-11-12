"use client";

import { usePathname } from "next/navigation";
import { use, useEffect, useEffectEvent } from "react";

import { tripDestination } from "@/core/navigation/state";
import type {
  NavigationActions,
  NavigationHold,
  NavigationHoldOptions,
  NavigationIntentListener,
  NavigationPayloadKey,
  NavigationPayloadValue,
  NavigationState,
  NavigationTrip,
} from "@/core/navigation/types";
import { isSamePathname } from "@/core/navigation/utils";
import { useRequiredContext, useStore } from "@/react/hooks";

import {
  INERT_NAVIGATION_ACTIONS,
  NavigationContext,
  NOOP_NAVIGATION_STORE,
} from "./context";

/**
 * Returns the navigation actions.
 */
export function useNavigation(): NavigationActions {
  return useRequiredContext(
    NavigationContext,
    "useNavigation",
    "NavigationProvider",
  ).actions;
}

/**
 * Like useNavigation, but returns inert actions outside a NavigationProvider.
 */
export function useOptionalNavigation(): NavigationActions {
  return use(NavigationContext)?.actions ?? INERT_NAVIGATION_ACTIONS;
}

/**
 * Subscribes to the navigation state. Accepts a selector; works outside a
 * provider with an idle state.
 */
export function useNavigationState(): NavigationState;
export function useNavigationState<T>(
  selector: (state: NavigationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useNavigationState<T = NavigationState>(
  selector?: (state: NavigationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const store = use(NavigationContext)?.store ?? NOOP_NAVIGATION_STORE;
  return useStore(store, selector as (state: NavigationState) => T, isEqual);
}

/**
 * Registers a hold that can delay or block navigation while the component is
 * mounted.
 */
export function useNavigationHold(
  hold: NavigationHold | false | null | undefined,
  { history = true }: NavigationHoldOptions = {},
): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { hold: register } = useOptionalNavigation();
  const runHold = useEffectEvent((trip: NavigationTrip) =>
    hold ? hold(trip) : undefined,
  );
  const enabled = Boolean(hold);
  useEffect(() => {
    if (!enabled) return;
    return register((trip) => runHold(trip), { history });
  }, [enabled, history, register]);
}

/**
 * Attaches a value to every navigation trip under a key while the component is
 * mounted.
 */
export function useNavigationPayload<K extends NavigationPayloadKey>(
  key: K,
  value: NavigationPayloadValue<K>,
): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { provide } = useOptionalNavigation();
  const readValue = useEffectEvent(() =>
    typeof value === "function" ? (value as () => unknown)() : value,
  );
  useEffect(
    () => provide(key, readValue as NavigationPayloadValue<K>),
    [key, provide],
  );
}

/**
 * Calls a listener when the user shows intent to navigate to a route.
 */
export function useNavigationIntent(listener: NavigationIntentListener): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { onIntent } = useOptionalNavigation();
  const handleIntent = useEffectEvent(
    (
      path: Parameters<NavigationIntentListener>[0],
      href: Parameters<NavigationIntentListener>[1],
    ) => listener(path, href),
  );
  useEffect(
    () => onIntent((path, href) => handleIntent(path, href)),
    [onIntent],
  );
}

/**
 * The active trip that is leaving the current page, or null.
 */
export function useDeparture(): NavigationTrip | null {
  const pathname = usePathname();
  const active = useNavigationState((state) => state.active);
  return active && !isSamePathname(tripDestination(active), pathname)
    ? active
    : null;
}

/**
 * The trip that just arrived at a page (default: the current one), or null.
 */
export function useArrival(pathname?: string): NavigationTrip | null {
  const routePathname = usePathname();
  const target = pathname ?? routePathname;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { arrival } = useOptionalNavigation();
  return useNavigationState(() => arrival(target));
}
