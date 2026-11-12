"use client";

import { usePathname } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

import { useRegistryEntries } from "@/core/kernel";
import {
  normalizePath,
  shallowEqual as areShallowCollectionsEqual,
} from "@/foundation/utils";
import { useTheme } from "@/react/theme";

import { applyMediaAction } from "../components/media-action";
import { DOCK_PENDING_ROUTE_HOLD_MS, dockTheme } from "../constants";
import {
  DockContext,
  useDockActions,
  useDockHasMedia,
  useDockLoadingState as useLoadingState,
  useDockMediaActions,
  useDockSelector,
} from "../context";
import { resolveDockAttention } from "../model/state";
import { createDockTopology } from "../routing/model/topology";
import { useDockStatus } from "../status/hooks";
import { createInlineSurfaceEntry } from "../surface/definition";
import { applySurfaceToDockItem } from "../surface/view-model";
import type { DockItem } from "../types";
import {
  applyAttentionToItem,
  type ResolveActiveItemOptions,
} from "./model/attention";
import {
  buildDockItems,
  type DockBaseMatch,
  isNotFoundItem,
  resolveBaseActiveItemMatch,
  selectPendingRouteItem,
} from "./model/items";
import { resolveActiveIndex } from "./pipeline";

export function usePendingRouteHold(
  pathname: string,
  match: DockBaseMatch,
  {
    holdMs = DOCK_PENDING_ROUTE_HOLD_MS,
    isNavigating = false,
  }: { holdMs?: number; isNavigating?: boolean } = {},
): DockItem | null {
  const normalizedPathname = normalizePath(pathname);
  const [lastMatched, setLastMatched] = useState<DockItem | null>(() =>
    match.isFallback ? null : match.item,
  );
  const [hold, setHold] = useState(() => ({
    isOpen: false,
    pathname: normalizedPathname,
  }));

  if (!match.isFallback && match.item !== lastMatched) {
    setLastMatched(match.item);
  }
  if (hold.pathname !== normalizedPathname) {
    setHold({ isOpen: true, pathname: normalizedPathname });
  }

  useEffect(() => {
    if (!hold.isOpen || isNavigating) return;
    const timer = setTimeout(
      () =>
        setHold((current) =>
          current.pathname === hold.pathname
            ? { ...current, isOpen: false }
            : current,
        ),
      holdMs,
    );
    return () => clearTimeout(timer);
  }, [hold, holdMs, isNavigating]);

  const selected = selectPendingRouteItem({
    heldItem: lastMatched,
    isHolding: hold.isOpen && hold.pathname === normalizedPathname,
    match,
    pathname: normalizedPathname,
  });
  const isHeld = selected !== match.item;
  // stable identity: effect dep (activeItem feeds publishRoute in
  // useDockViewConnection)
  return useMemo(
    () =>
      isHeld && selected ? { ...selected, isRoutePending: true } : selected,
    [isHeld, selected],
  );
}

/**
 * Resolves the item the dock shows: the base route item with the surface,
 * status or media action that currently has attention applied on top.
 */
export function resolveActiveItem({
  rawItems,
  dockItems,
  pathname,
  isNotFoundPage,
  surfaceState,
  statusState,
  hasMedia,
  toggleMedia,
  mediaAction,
  actionStackClass,
  surfaceActions,
  attention,
  baseActiveItem: resolvedBaseActiveItem,
}: ResolveActiveItemOptions): DockItem | null {
  const baseActiveItem =
    resolvedBaseActiveItem !== undefined
      ? resolvedBaseActiveItem
      : resolveBaseActiveItemMatch({
          rawItems,
          dockItems,
          pathname,
          isNotFoundPage,
        }).item;
  if (!baseActiveItem) return null;

  const attentionItem = applyAttentionToItem(
    baseActiveItem,
    attention,
    surfaceState,
    statusState,
    surfaceActions,
  );
  if (attentionItem !== undefined) return attentionItem;

  const itemWithMediaAction = applyMediaAction(
    baseActiveItem,
    hasMedia,
    toggleMedia,
    mediaAction,
    actionStackClass,
  );
  const inlineSurface = createInlineSurfaceEntry(itemWithMediaAction?.surface);

  if (inlineSurface)
    return applySurfaceToDockItem(
      itemWithMediaAction,
      inlineSurface,
      surfaceActions,
    );
  return itemWithMediaAction;
}

function stripChildrenSystemFields(item: DockItem): DockItem {
  return {
    ...item,
    activeChild: null,
    children: null,
    hasActiveChild: false,
    isExpanded: false,
    isParent: false,
  };
}

export function useDockItems(): { rawItems: DockItem[] } {
  const entries = useRegistryEntries<"dock", DockItem>("dock");
  // stable identity: render-phase comparison (usePendingRouteHold compares
  // match.item, which comes from these items, against its held item)
  const rawItems = useMemo(
    () => Object.values(entries).map(stripChildrenSystemFields),
    [entries],
  );
  return { rawItems };
}

export function useDockDisplay(
  overridePathname?: string,
  { isNavigating = false }: { isNavigating?: boolean } = {},
) {
  const routerPathname = usePathname();
  const pathname = overridePathname || routerPathname;
  const loadingState = useLoadingState();
  const isPageLoading = Boolean(loadingState?.isLoading);
  const { rawItems } = useDockItems();

  const {
    closeAllSurfaces,
    goBackSurface,
    closeSurface,
    pushStep,
    popStep,
    goToStep,
    getSurfaceFlow,
  } = useDockActions();

  const {
    expanded,
    searchQuery,
    activeSurfaceId,
    activeSurfaceEntry,
    activeOperation,
    hud,
    isSurfaceOpen,
    surfaceStack,
    surfacePhase,
  } = useDockSelector(
    (state) => ({
      activeOperation: state.activeOperation,
      activeSurfaceEntry: state.activeSurfaceEntry,
      activeSurfaceId: state.activeSurfaceId,
      expanded: state.expanded,
      hud: state.hud,
      isSurfaceOpen: state.isSurfaceOpen,
      searchQuery: state.searchQuery,
      surfacePhase: state.surfacePhase,
      surfaceStack: state.surfaceStack,
    }),
    areShallowCollectionsEqual,
  );

  // stable identity: input of the attention and activeItem memos below
  const surfaceState = useMemo(
    () => ({
      activeSurfaceId,
      activeSurfaceEntry,
      isSurfaceOpen,
      surfaceStack,
      surfacePhase,
    }),
    [
      activeSurfaceId,
      activeSurfaceEntry,
      isSurfaceOpen,
      surfaceStack,
      surfacePhase,
    ],
  );

  const dockCtx = use(DockContext);
  const mediaAction = dockCtx?.runtimeActions?.mediaAction ?? null;
  const notFoundAction = dockCtx?.runtimeActions?.notFoundAction ?? null;
  const statusState = useDockStatus({ notFoundAction });
  const hasMedia = useDockHasMedia();
  const actionStackClass = useTheme(dockTheme).slots.actionStack;
  const { toggle: toggleMedia } = useDockMediaActions();

  // stable identity: input of activeItem; returned to useDock consumers
  const attention = useMemo(
    () =>
      resolveDockAttention({
        hud,
        isPageLoading,
        operation: activeOperation,
        status: statusState,
        surface: surfaceState,
      }),
    [activeOperation, hud, isPageLoading, statusState, surfaceState],
  );

  const isNotFoundPage = rawItems.some(isNotFoundItem);

  // stable identity: render-phase comparison (match.item comes from these)
  const dockItems = useMemo(
    () => buildDockItems({ rawItems, expanded, searchQuery, isNotFoundPage }),
    [rawItems, expanded, searchQuery, isNotFoundPage],
  );

  // stable identity: render-phase comparison in usePendingRouteHold
  const baseMatch = useMemo(
    () =>
      resolveBaseActiveItemMatch({
        rawItems,
        dockItems,
        pathname,
        isNotFoundPage,
      }),
    [rawItems, dockItems, pathname, isNotFoundPage],
  );
  const baseActiveItem = usePendingRouteHold(pathname, baseMatch, {
    isNavigating,
  });

  // stable identity: effect dep (publishRoute in useDockViewConnection)
  const activeItem = useMemo(
    () =>
      resolveActiveItem({
        baseActiveItem,
        rawItems,
        dockItems,
        pathname,
        isNotFoundPage,
        surfaceState,
        statusState,
        hasMedia,
        toggleMedia,
        mediaAction,
        actionStackClass,
        surfaceActions: {
          closeSurface,
          closeAllSurfaces,
          goBackSurface,
          pushStep,
          popStep,
          goToStep,
          getSurfaceFlow,
          surfaceStack,
        },
        isPageLoading,
        attention,
      }),
    [
      baseActiveItem,
      rawItems,
      dockItems,
      pathname,
      isNotFoundPage,
      surfaceState,
      statusState,
      hasMedia,
      toggleMedia,
      mediaAction,
      actionStackClass,
      closeSurface,
      closeAllSurfaces,
      goBackSurface,
      pushStep,
      popStep,
      goToStep,
      getSurfaceFlow,
      surfaceStack,
      isPageLoading,
      attention,
    ],
  );

  const activeIndex = resolveActiveIndex({ dockItems, activeItem, pathname });

  // stable identity: returned to useDock consumers
  const topology = useMemo(
    () => createDockTopology(dockItems, { pathname }),
    [dockItems, pathname],
  );

  // stable identity: carries the stable values above to useDock
  return useMemo(
    () => ({
      dockItems,
      activeItem,
      activeIndex,
      statusState,
      attention,
      topology,
    }),
    [dockItems, activeItem, activeIndex, statusState, attention, topology],
  );
}
