"use client";

import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useLayoutEffect,
  useState,
} from "react";

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

type DockRouter = ReturnType<typeof useRouter>;

function createRouteBridge(
  initialRouter: DockRouter,
  setRouteState: Dispatch<SetStateAction<DockRouteSnapshot>>,
) {
  let router = initialRouter;
  let navigator: DockActions["navigate"] | null = null;

  const navigate: DockActions["navigate"] = async (href, options) => {
    if (navigator) return navigator(href, options);
    if (!href) return false;
    router.push(href);
    return true;
  };

  const viewBridge: DockViewBridge = {
    publishRoute: (snapshot) =>
      setRouteState((current) =>
        current.activeItem === snapshot.activeItem &&
        current.locationKey === snapshot.locationKey &&
        current.pathname === snapshot.pathname
          ? current
          : snapshot,
      ),
    setNavigator: (next) => {
      navigator = next;
    },
  };

  return {
    navigate,
    setRouter: (next: DockRouter) => {
      router = next;
    },
    viewBridge,
  };
}

export function useDockRouteBridge() {
  const router = useRouter();
  const [routeState, setRouteState] =
    useState<DockRouteSnapshot>(EMPTY_ROUTE_STATE);
  const [{ navigate, setRouter, viewBridge }] = useState(() =>
    createRouteBridge(router, setRouteState),
  );
  useLayoutEffect(() => {
    setRouter(router);
  }, [router, setRouter]);

  return { navigate, routeState, viewBridge };
}
