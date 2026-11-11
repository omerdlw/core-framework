"use client";

import { normalizePath } from "@/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequiredContext, useStore } from "@/hooks";
import { useModule } from "@/kernel";
import { shallowEqual } from "@/utils";
import { globalEvents } from "@/events";
import { isSafeInternalHref, isSamePath, getDockLocationKey } from "../paths";
import {
  PrefetchingRouter,
  RoutePrefetchState,
  type DockItem,
  type DockRoutePolicy,
  type DockRoutePolicyOverrides,
  type DockTopology,
  type DockTopologyNode,
  type DockActions,
  type DockRouteSnapshot,
} from "../types";
import { DOCK_PREFETCH_INTENT_DELAY_MS, DOCK_EVENTS } from "../constants";
import {
  DockContext,
  useDockLoadingActions as useLoadingActions,
  useDockActions,
} from "../context";
import { blurActiveElement } from "../dom";
import { openDockGuardConfirmation } from "./guards";
import { createNavigator } from "../../navigation/navigator";
import { NAVIGATION_STATUS } from "../../navigation/constants";
import type {
  NavigationActions,
  NavigationBlock,
  NavigationRouter,
  NavigationState,
  Navigator,
} from "../../navigation/types";
import { report } from "@/utils";

function getRoutePolicyOverrides(
  item: DockItem | null | undefined,
): DockRoutePolicyOverrides {
  return item?.dockPolicy && typeof item.dockPolicy === "object"
    ? item.dockPolicy!
    : {};
}

function resolvePolicyBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveDockRoutePolicy({
  href,
  item = null,
}: { href?: string; item?: DockItem | null } = {}): DockRoutePolicy {
  const overrides = getRoutePolicyOverrides(item);
  const canNavigate = isSafeInternalHref(href);
  const canPrefetch =
    canNavigate &&
    !item?.isLoading &&
    !item?.isOverlay &&
    !item?.isSurface &&
    !item?.prefetchDisabled;

  return {
    canNavigate,
    clearTransientState: resolvePolicyBoolean(
      overrides.clearTransientState,
      true,
    ),
    dismissSurfaces: resolvePolicyBoolean(overrides.dismissSurfaces, true),
    prefetch:
      resolvePolicyBoolean(overrides.prefetch, canPrefetch) && canPrefetch,
  };
}

export function formatSlugTitle(slug = ""): string {
  if (!slug) return "";
  return String(slug)
    .split(/[-_]+/)
    .map((word) =>
      word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "",
    )
    .filter(Boolean)
    .join(" ");
}

function getTopologyNodeId(item: DockItem, index: number): string {
  return item?.id || item?.path || item?.name || `dock-node-${index}`;
}

function flattenDockTopology(
  items: DockItem[] | null | undefined,
  parentId: string | null = null,
  depth = 0,
  nodes: DockTopologyNode[] = [],
): DockTopologyNode[] {
  if (!Array.isArray(items)) return nodes;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;

    const id = getTopologyNodeId(item, nodes.length);
    nodes.push({ depth, id, parentId, path: normalizePath(item.path || "") });

    if (item.children) {
      flattenDockTopology(item.children, id, depth + 1, nodes);
    }
  }
  return nodes;
}

function resolveTopologyActiveNode(
  nodes: DockTopologyNode[],
  pathname: string,
): DockTopologyNode | null {
  const normalizedPath = normalizePath(pathname || "");
  return nodes.find((node) => isSamePath(node.path, normalizedPath)) || null;
}

function resolveTopologyAncestors(
  nodes: DockTopologyNode[],
  activeNode: DockTopologyNode | null,
): DockTopologyNode[] {
  if (!activeNode) return [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const ancestors: DockTopologyNode[] = [];
  let currentNode: DockTopologyNode | undefined = activeNode;

  while (currentNode?.parentId) {
    currentNode = nodesById.get(currentNode.parentId);
    if (currentNode) ancestors.unshift(currentNode);
  }
  return ancestors;
}

export function createDockTopology(
  items: DockItem[] = [],
  { pathname = "" }: { pathname?: string } = {},
): DockTopology {
  const nodes = flattenDockTopology(items);
  const activePath = normalizePath(pathname || "");
  const activeNode = resolveTopologyActiveNode(nodes, activePath);

  return {
    activeNode,
    activePath,
    ancestors: resolveTopologyAncestors(nodes, activeNode),
    nodes,
  };
}

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

  const cancelRoutePrefetch = useCallback((href: string) => {
    const routeState = routeStatesRef.current.get(href);
    if (routeState?.timeoutId == null) return false;
    clearTimeout(routeState.timeoutId);
    routeStatesRef.current.delete(href);
    return true;
  }, []);

  const prefetchRoute = useCallback(
    (href: string, { immediate = false }: { immediate?: boolean } = {}) => {
      if (
        !isSafeInternalHref(href) ||
        (!navigator && typeof router?.prefetch !== "function")
      )
        return false;

      const routeState = routeStatesRef.current.get(href);
      if (routeState?.isPrefetched || routeState?.timeoutId != null)
        return false;

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
    },
    [intentDelayMs, navigator, router],
  );

  useEffect(() => {
    const routeStates = routeStatesRef.current;
    return () => {
      routeStates.forEach((routeState) => {
        if (routeState.timeoutId != null) clearTimeout(routeState.timeoutId);
      });
      routeStates.clear();
    };
  }, []);

  return useMemo(
    () => ({ cancelRoutePrefetch, prefetchRoute }),
    [cancelRoutePrefetch, prefetchRoute],
  );
}

const LOCATION_SYNC_EVENT = "dock:location-sync";

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

  const getBrowserLocationKey = useCallback(
    () =>
      getDockLocationKey({
        hash: typeof window === "undefined" ? "" : window.location.hash,
        pathname,
        search: typeof window === "undefined" ? "" : window.location.search,
      }),
    [pathname],
  );

  const getServerLocationKey = useCallback(
    () => getDockLocationKey({ hash: "", pathname, search: "" }),
    [pathname],
  );
  const locationKey = useSyncExternalStore(
    subscribeToBrowserLocation,
    getBrowserLocationKey,
    getServerLocationKey,
  );

  const syncLocationKey = useCallback(() => {
    window.dispatchEvent(new Event(LOCATION_SYNC_EVENT));
    return getBrowserLocationKey();
  }, [getBrowserLocationKey]);

  return { locationKey, syncLocationKey };
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
    } else if (
      lastTransaction.status === NAVIGATION_STATUS.TIMED_OUT ||
      lastTransaction.status === NAVIGATION_STATUS.FAILED
    ) {
      clearPreparedRouteReset();
      stopLoading();
    }
  }, [clearPreparedRouteReset, lastTransaction, stopLoading, syncLocationKey]);

  const cancelDock = useCallback(
    (reason = "guard") => {
      navigator.cancel(reason);
      clearPreparedRouteReset();
      closeSurface({ cancelled: true, reason, success: false });
    },
    [clearPreparedRouteReset, closeSurface, navigator],
  );

  const commitDock = useCallback(
    async ({
      force = false,
      from,
      href,
      item,
      routePolicy,
      source = "dock",
    }: {
      force?: boolean;
      from: string;
      href: string;
      item?: DockItem | null;
      routePolicy: DockRoutePolicy;
      source?: string;
    }) => {
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
            void commitDock({ ...confirmed, force: true }).catch((error) =>
              report("Dock route transition", error),
            ),
          from,
          href,
          message: result.blocked.message,
          routePolicy,
        });
      }
      return false;
    },
    [closeSurface, continuity, guards, navigator, prepareRouteReset],
  );

  const navigate = useCallback(
    async (
      href: string,
      {
        force = false,
        item = null,
        source = "dock",
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
