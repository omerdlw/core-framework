"use client";

import { useEffect, useRef } from "react";

import type { NavigationActions } from "@/core/navigation/types";
import { report } from "@/foundation/utils";

import { DOCK_PREFETCH_INTENT_DELAY_MS } from "../../constants";
import { isSafeInternalHref } from "../../model/paths";
import type { PrefetchingRouter, RoutePrefetchState } from "../../types";

export function useRoutePrefetch(
  router: PrefetchingRouter | null | undefined,
  {
    intentDelayMs = DOCK_PREFETCH_INTENT_DELAY_MS,
    navigator = null,
  }: {
    intentDelayMs?: number;
    navigator?: Pick<NavigationActions, "prefetch"> | null;
  } = {},
) {
  const routeStatesRef = useRef(new Map<string, RoutePrefetchState>());

  // Compiled: the compiler keeps both functions and the returned object
  // stable while router, navigator and intentDelayMs are.
  const cancelRoutePrefetch = (href: string) => {
    const routeState = routeStatesRef.current.get(href);
    if (routeState?.timeoutId == null) return false;
    clearTimeout(routeState.timeoutId);
    routeStatesRef.current.delete(href);
    return true;
  };

  const prefetchRoute = (
    href: string,
    { immediate = false }: { immediate?: boolean } = {},
  ) => {
    if (
      !isSafeInternalHref(href) ||
      (!navigator && typeof router?.prefetch !== "function")
    )
      return false;

    const routeState = routeStatesRef.current.get(href);
    if (routeState?.isPrefetched || routeState?.timeoutId != null) return false;

    const startPrefetch = () => {
      const currentState = routeStatesRef.current.get(href);
      if (!currentState) return;

      currentState.timeoutId = null;
      if (navigator) {
        routeStatesRef.current.delete(href);
        navigator.prefetch(href);
        return;
      }
      currentState.isPrefetched = true;

      try {
        router!.prefetch(href, {
          onInvalidate: () => {
            const invalidatedState = routeStatesRef.current.get(href);
            if (!invalidatedState) return;
            invalidatedState.isPrefetched = false;
            if (invalidatedState.timeoutId == null)
              routeStatesRef.current.delete(href);
          },
        });
      } catch (error) {
        routeStatesRef.current.delete(href);
        report("Dock route prefetch", error, "warn");
      }
    };

    const delay = immediate ? 0 : Math.max(0, Number(intentDelayMs) || 0);
    const nextState: RoutePrefetchState = {
      isPrefetched: false,
      timeoutId: null,
    };

    routeStatesRef.current.set(href, nextState);
    if (delay === 0) startPrefetch();
    else nextState.timeoutId = setTimeout(startPrefetch, delay);

    return true;
  };

  useEffect(() => {
    const routeStates = routeStatesRef.current;
    return () => {
      routeStates.forEach((routeState) => {
        if (routeState.timeoutId != null) clearTimeout(routeState.timeoutId);
      });
      routeStates.clear();
    };
  }, []);

  return { cancelRoutePrefetch, prefetchRoute };
}
