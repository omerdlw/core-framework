"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useModule } from "@/core/kernel";
import { NAVIGATION_STATUS } from "@/core/navigation/constants";
import { createNavigator } from "@/core/navigation/navigator";
import type {
  NavigationBlock,
  NavigationRouter,
  NavigationState,
  Navigator,
} from "@/core/navigation/types";
import { globalEvents } from "@/foundation/events";
import { report, shallowEqual } from "@/foundation/utils";
import { useRequiredContext, useStore } from "@/react/hooks";

import { DOCK_EVENTS } from "../constants";
import {
  DockContext,
  useDockActions,
  useDockLoadingActions as useLoadingActions,
} from "../context";
import { blurActiveElement } from "../lib/dom";
import { getDockLocationKey, isSamePath } from "../model/paths";
import type {
  DockActions,
  DockItem,
  DockRoutePolicy,
  DockRouteSnapshot,
} from "../types";
import { openDockGuardConfirmation } from "./guards";
import { resolveDockRoutePolicy } from "./model/policy";

const LOCATION_SYNC_EVENT = "dock:location-sync";
const DEFAULT_NAVIGATION_SOURCE = "dock";
const GUARD_CANCEL_REASON = "guard";

function isFailedNavigation(status: string) {
  return (
    status === NAVIGATION_STATUS.TIMED_OUT ||
    status === NAVIGATION_STATUS.FAILED
  );
}

function subscribeToBrowserLocation(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(LOCATION_SYNC_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(LOCATION_SYNC_EVENT, onChange);
  };
}

export function useDockLocationKey() {
  const pathname = usePathname();

  const getBrowserLocationKey = () =>
    getDockLocationKey({
      hash: typeof window === "undefined" ? "" : window.location.hash,
      pathname,
      search: typeof window === "undefined" ? "" : window.location.search,
    });

  const getServerLocationKey = () =>
    getDockLocationKey({ hash: "", pathname, search: "" });
  const locationKey = useSyncExternalStore(
    subscribeToBrowserLocation,
    getBrowserLocationKey,
    getServerLocationKey,
  );

  return { locationKey, syncLocationKey };
}

/**
 * Makes useSyncExternalStore re-read the location key. Module level, so it is
 * a stable effect dep in useDockNavigation.
 */
function syncLocationKey() {
  window.dispatchEvent(new Event(LOCATION_SYNC_EVENT));
}

export function useDockViewConnection({
  activeItem,
  locationKey,
  navigate,
  pathname,
}: DockRouteSnapshot & { navigate: DockActions["navigate"] }) {
  const { view } = useRequiredContext(
    DockContext,
    "useDockViewConnection",
    "DockProvider",
  );
  useEffect(() => {
    view.publishRoute({ activeItem, locationKey, pathname });
  }, [activeItem, locationKey, pathname, view]);
  useEffect(() => {
    view.setNavigator(navigate);
    return () => view.setNavigator(null);
  }, [navigate, view]);
}

function emitDockEvent(eventType: string, data: Record<string, unknown> = {}) {
  return globalEvents.emit(eventType, {
    timestamp: Date.now(),
    type: eventType,
    ...data,
  });
}

function useDockNavigator(router: NavigationRouter): Navigator {
  const shared = useModule("navigation");
  const [own] = useState(() => (shared ? null : createNavigator({ router })));
  useEffect(() => {
    own?.setRouter(router);
  }, [own, router]);
  useEffect(() => (own ? () => own.dispose() : undefined), [own]);
  // stable identity: effect dep (the arrive and setNavigator effects) and
  // input of useDock's navigate
  return useMemo(
    () =>
      own ?? { ...shared!.actions, dispose: () => {}, store: shared!.store },
    [own, shared],
  );
}

const selectTrips = (state: NavigationState) => ({
  active: state.active,
  last: state.last,
});

interface DockCommitRequest {
  force?: boolean;
  from: string;
  href: string;
  item?: DockItem | null;
  routePolicy: DockRoutePolicy;
  source?: string;
}

export function useDockNavigation() {
  const pathname = usePathname();
  const { locationKey, syncLocationKey } = useDockLocationKey();
  const router = useRouter();

  const {
    clearPreparedRouteReset,
    closeSurface,
    continuity,
    prepareRouteReset,
  } = useDockActions();
  const { stopLoading } = useLoadingActions();
  const { guards } = useRequiredContext(
    DockContext,
    "useDockNavigation",
    "DockProvider",
  );

  const navigator = useDockNavigator(router);
  const { active: activeTransaction, last: lastTransaction } = useStore(
    navigator.store,
    selectTrips,
    shallowEqual,
  );

  const previousLocationKeyRef = useRef(locationKey);
  const settledTripRef = useRef(lastTransaction);

  useEffect(() => {
    if (settledTripRef.current === lastTransaction) return;
    settledTripRef.current = lastTransaction;
    if (!lastTransaction) return;
    if (lastTransaction.status === NAVIGATION_STATUS.COMPLETED) {
      syncLocationKey();
    } else if (isFailedNavigation(lastTransaction.status)) {
      clearPreparedRouteReset();
      stopLoading();
    }
  }, [clearPreparedRouteReset, lastTransaction, stopLoading, syncLocationKey]);

  // stable identity: dep of useDock's callbacks, which must hold without the
  // compiler (tests run the uncompiled source)
  const cancelDock = useCallback(
    (reason = GUARD_CANCEL_REASON) => {
      navigator.cancel(reason);
      clearPreparedRouteReset();
      closeSurface({ cancelled: true, reason, success: false });
    },
    [clearPreparedRouteReset, closeSurface, navigator],
  );

  // stable identity: input of navigate below
  const commitDock = useCallback(
    (request: DockCommitRequest): Promise<boolean> => {
      // A confirmed guard re-runs through this local function rather than
      // through commitDock itself, so the hook stays compilable.
      const run = async ({
        force = false,
        from,
        href,
        item,
        routePolicy,
        source = DEFAULT_NAVIGATION_SOURCE,
      }: DockCommitRequest): Promise<boolean> => {
        const result = await navigator.navigate(href, {
          force,
          guard:
            guards.count() > 0
              ? () => guards.check(href, from) as Promise<NavigationBlock>
              : undefined,
          onCommit: () => {
            continuity?.remember?.(from);
            blurActiveElement();
            prepareRouteReset(routePolicy);
            emitDockEvent(DOCK_EVENTS.NAVIGATE_START, { from, to: href });
          },
          source,
        });
        if (result.ok) {
          emitDockEvent(DOCK_EVENTS.NAVIGATE, { from, item, to: href });
          return true;
        }
        if (result.blocked) {
          blurActiveElement();
          openDockGuardConfirmation({
            closeSurface,
            commit: (confirmed) =>
              void run({ ...confirmed, force: true }).catch((error) =>
                report("Dock route transition", error),
              ),
            from,
            href,
            message: result.blocked.message,
            routePolicy,
          });
        }
        return false;
      };
      return run(request);
    },
    [closeSurface, continuity, guards, navigator, prepareRouteReset],
  );

  // stable identity: dep of useDock's navigate (see cancelDock)
  const navigate = useCallback(
    async (
      href: string,
      {
        force = false,
        item = null,
        source = DEFAULT_NAVIGATION_SOURCE,
      }: { force?: boolean; item?: DockItem | null; source?: string } = {},
    ) => {
      if (!href) return false;
      const from = locationKey;
      const routePolicy = resolveDockRoutePolicy({ href, item });

      if (!routePolicy.canNavigate) {
        return false;
      }
      if (isSamePath(href, from)) return false;

      try {
        return await commitDock({ force, from, href, routePolicy, source });
      } catch (error) {
        stopLoading();
        report("Dock navigation", error);
        return false;
      }
    },
    [commitDock, locationKey, stopLoading],
  );

  useEffect(() => {
    navigator.arrive(locationKey);
    if (previousLocationKeyRef.current === locationKey) return;
    emitDockEvent(DOCK_EVENTS.NAVIGATE_END, {
      duration: undefined,
      from: previousLocationKeyRef.current,
      to: locationKey,
    });
    previousLocationKeyRef.current = locationKey;
    stopLoading();
  }, [locationKey, navigator, stopLoading]);

  return {
    activeTransaction,
    cancelDock,
    lastTransaction,
    locationKey,
    navigate,
    pathname,
  };
}
