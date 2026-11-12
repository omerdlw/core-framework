"use client";

import { useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  useIsomorphicLayoutEffect,
  useRequiredContext,
  useStore,
} from "@/react/hooks";
import {
  INERT_NAVIGATION_ACTIONS,
  NOOP_NAVIGATION_STORE,
  NavigationContext,
} from "./context";
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

export function useNavigation(): NavigationActions {
  return useRequiredContext(
    NavigationContext,
    "useNavigation",
    "NavigationProvider",
  ).actions;
}

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
  return useStore(store, selector as (state: NavigationState) => T, isEqual);
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useNavigationHold(
  hold: NavigationHold | false | null | undefined,
  { history = true }: NavigationHoldOptions = {},
): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { hold: register } = useOptionalNavigation();
  const latest = useLatest(hold);
  const enabled = Boolean(hold);
  useEffect(() => {
    if (!enabled) return;
    return register(
      (trip) => {
        const run = latest.current;
        return run ? run(trip) : undefined;
      },
      { history },
    );
  }, [enabled, history, latest, register]);
}

export function useNavigationPayload<K extends NavigationPayloadKey>(
  key: K,
  value: NavigationPayloadValue<K>,
): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
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

export function useNavigationIntent(listener: NavigationIntentListener): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { onIntent } = useOptionalNavigation();
  const latest = useLatest(listener);
  useEffect(
    () => onIntent((path, href) => latest.current(path, href)),
    [latest, onIntent],
  );
}

export function useDeparture(): NavigationTrip | null {
  const pathname = usePathname();
  const active = useNavigationState((state) => state.active);
  return active && !isSamePathname(tripDestination(active), pathname)
    ? active
    : null;
}

export function useArrival(pathname?: string): NavigationTrip | null {
  const routePathname = usePathname();
  const target = pathname ?? routePathname;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the navigation API comes from createNavigator closures or the arrow-function default context, none of which use this
  const { arrival } = useOptionalNavigation();
  return useNavigationState(() => arrival(target));
}
