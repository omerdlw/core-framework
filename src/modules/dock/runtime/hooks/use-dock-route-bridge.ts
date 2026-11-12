"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import type {
  DockActions,
  DockRouteSnapshot,
  DockViewBridge,
} from "../../types";

const EMPTY_ROUTE_STATE: DockRouteSnapshot = Object.freeze({
  activeItem: null,
  locationKey: "",
  pathname: "",
});

export function useDockRouteBridge() {
  const router = useRouter();
  const [routeState, setRouteState] =
    useState<DockRouteSnapshot>(EMPTY_ROUTE_STATE);
  const navigatorRef = useRef<DockActions["navigate"] | null>(null);

  const navigate = useCallback<DockActions["navigate"]>(
    async (href, options) => {
      if (navigatorRef.current) return navigatorRef.current(href, options);
      if (!href) return false;
      router.push(href);
      return true;
    },
    [router],
  );

  const viewBridge = useMemo<DockViewBridge>(
    () => ({
      publishRoute: (snapshot) =>
        setRouteState((current) =>
          current.activeItem === snapshot.activeItem &&
          current.locationKey === snapshot.locationKey &&
          current.pathname === snapshot.pathname
            ? current
            : snapshot,
        ),
      setNavigator: (next) => {
        navigatorRef.current = next;
      },
    }),
    [],
  );

  return { navigate, routeState, viewBridge };
}
