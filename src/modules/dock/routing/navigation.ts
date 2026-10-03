"use client";

import { normalizePath } from "@/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequiredContext } from "@/hooks";
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
  type DockTransaction,
} from "../types";
import { DOCK_PREFETCH_INTENT_DELAY_MS, DOCK_EVENTS } from "../constants";
import {
  DockContext,
  useDockLoadingActions as useLoadingActions,
  useDockActions,
} from "../context";
import { blurActiveElement } from "../dom";
import { openDockGuardConfirmation } from "./guards";
import { useDockTransactions } from "./transactions";
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
  }: { intentDelayMs?: number } = {},
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
      if (!isSafeInternalHref(href) || typeof router?.prefetch !== "function")
        return false;

      const routeState = routeStatesRef.current.get(href);
      if (routeState?.isPrefetched || routeState?.timeoutId != null)
        return false;

      const startPrefetch = () => {
        const currentState = routeStatesRef.current.get(href);
        if (!currentState) return;

        currentState.timeoutId = null;
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
    [intentDelayMs, router],
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

  const previousLocationKeyRef = useRef(locationKey);

  const handleTransactionTimeout = useCallback(() => {
    clearPreparedRouteReset();
    stopLoading();
  }, [clearPreparedRouteReset, stopLoading]);

  const {
    activeTransaction,
    beginTransaction,
    cancelActiveTransaction,
    cancelTransaction,
    completeTransactionForPath,
    failTransaction,
    isTransactionCurrent,
    lastTransaction,
  } = useDockTransactions({
    onTimeout: handleTransactionTimeout,
  });

  const cancelDock = useCallback(
    (reason = "guard") => {
      cancelActiveTransaction(reason);
      clearPreparedRouteReset();
      closeSurface({ cancelled: true, reason, success: false });
    },
    [cancelActiveTransaction, clearPreparedRouteReset, closeSurface],
  );

  const commitDock = useCallback(
    ({
      from,
      href,
      routePolicy,
      source = "dock",
      transaction = null,
    }: {
      from: string;
      href: string;
      routePolicy: DockRoutePolicy;
      source?: string;
      transaction?: DockTransaction | null;
    }) => {
      const activeRouteTransaction =
        transaction || beginTransaction({ from, source, to: href });
      if (!isTransactionCurrent(activeRouteTransaction.id)) return false;

      try {
        continuity?.remember?.(from);
        blurActiveElement();
        prepareRouteReset(routePolicy);

        emitDockEvent(DOCK_EVENTS.NAVIGATE_START, { from, to: href });
        router.push(href);
        emitDockEvent(DOCK_EVENTS.NAVIGATE, {
          from,
          item: undefined,
          to: href,
        });

        if (typeof window !== "undefined") {
          const currentUrl = new URL(window.location.href);
          const destinationUrl = new URL(href, window.location.origin);

          if (
            normalizePath(currentUrl.pathname) ===
            normalizePath(destinationUrl.pathname)
          ) {
            window.requestAnimationFrame(() => {
              const currentLocKey = getDockLocationKey({
                hash: window.location.hash,
                pathname: window.location.pathname,
                search: window.location.search,
              });
              if (
                !isSamePath(currentLocKey, href) ||
                !completeTransactionForPath(currentLocKey)
              )
                return;

              emitDockEvent(DOCK_EVENTS.NAVIGATE_END, {
                duration: undefined,
                from,
                to: currentLocKey,
              });
              previousLocationKeyRef.current = currentLocKey;
              syncLocationKey();
              stopLoading();
            });
          }
        }
        return true;
      } catch (error) {
        clearPreparedRouteReset();
        failTransaction(activeRouteTransaction.id, error);
        stopLoading();
        report("Dock route transition", error);
        return false;
      }
    },
    [
      beginTransaction,
      clearPreparedRouteReset,
      completeTransactionForPath,
      continuity,
      failTransaction,
      isTransactionCurrent,
      prepareRouteReset,
      router,
      stopLoading,
      syncLocationKey,
    ],
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

      const transaction = beginTransaction({ from, source, to: href });

      try {
        if (!force && guards.count() > 0) {
          const guardResult = await guards.check(href, from);
          if (!isTransactionCurrent(transaction.id)) return false;
          if (guardResult.blocked) {
            cancelTransaction(transaction.id, "guard");
            blurActiveElement();
            openDockGuardConfirmation({
              closeSurface,
              commit: commitDock,
              from,
              href,
              message: guardResult.message,
              routePolicy,
            });
            return false;
          }
        }
        return commitDock({
          from,
          href,
          routePolicy,
          source,
          transaction,
        });
      } catch (error) {
        failTransaction(transaction.id, error);
        stopLoading();
        report("Dock navigation guard", error);
        return false;
      }
    },
    [
      guards,
      beginTransaction,
      cancelTransaction,
      commitDock,
      failTransaction,
      isTransactionCurrent,
      closeSurface,
      locationKey,
      stopLoading,
    ],
  );

  useEffect(() => {
    if (previousLocationKeyRef.current === locationKey) return;
    emitDockEvent(DOCK_EVENTS.NAVIGATE_END, {
      duration: undefined,
      from: previousLocationKeyRef.current,
      to: locationKey,
    });
    completeTransactionForPath(locationKey);
    previousLocationKeyRef.current = locationKey;
    stopLoading();
  }, [completeTransactionForPath, locationKey, stopLoading]);

  return {
    activeTransaction,
    cancelDock,
    lastTransaction,
    locationKey,
    navigate,
    pathname,
  };
}
