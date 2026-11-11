"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsomorphicLayoutEffect } from "@/hooks";
import { getOrCreateGlobalContext } from "@/kernel";
import { createStore } from "@/utils";
import { watchHistory, watchIntent } from "./listeners";
import { createNavigator } from "./navigator";
import { getNavigationSettings } from "./settings";
import { createNavigationState } from "./state";
import type {
  NavigationActions,
  NavigationResult,
  NavigationRouter,
  NavigationRuntime,
  NavigationState,
} from "./types";
import { readWindowLocation } from "./utils";

export const NavigationContext =
  getOrCreateGlobalContext<NavigationRuntime | null>("NavigationContext", null);

const noop = () => {};
const NOT_HANDLED: NavigationResult = Object.freeze({ ok: false, trip: null });

export const INERT_NAVIGATION_ACTIONS: NavigationActions = Object.freeze({
  arrival: () => null,
  arrive: noop,
  cancel: () => false,
  depart: () => null,
  hold: () => noop,
  holdsHistory: () => false,
  navigate: async () => NOT_HANDLED,
  onIntent: () => noop,
  prefetch: () => false,
  provide: () => noop,
  setRouter: noop,
});

export const NOOP_NAVIGATION_STORE = createStore<NavigationState>(
  createNavigationState(),
);

export function NavigationProvider({ children }: { children?: ReactNode }) {
  const router: NavigationRouter = useRouter();
  const pathname = usePathname();
  const [navigator] = useState(() => createNavigator({ router }));

  useIsomorphicLayoutEffect(() => {
    navigator.setRouter(router);
  }, [navigator, router]);

  useEffect(() => {
    navigator.arrive(readWindowLocation() ?? pathname);
  }, [navigator, pathname]);

  useEffect(() => watchHistory(navigator), [navigator]);
  useEffect(() => watchIntent(navigator, getNavigationSettings), [navigator]);
  useEffect(() => () => navigator.dispose(), [navigator]);

  const runtime = useMemo<NavigationRuntime>(
    () => ({ actions: navigator, store: navigator.store }),
    [navigator],
  );

  return <NavigationContext value={runtime}>{children}</NavigationContext>;
}
