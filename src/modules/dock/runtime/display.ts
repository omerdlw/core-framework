"use client";

import { type ComponentType, use, useEffect, useMemo, useState } from "react";
import { useRegistryEntries } from "@/core/kernel";
import {
  shallowEqual as areShallowCollectionsEqual,
  normalizePath,
} from "@/foundation/utils";
import { usePathname } from "next/navigation";
import { useModuleTheme } from "@/react/theme";
import { resolveActiveIndex } from "./pipeline";
import {
  DOCK_ATTENTION_KIND,
  DOCK_PENDING_ROUTE_HOLD_MS,
  dockTheme,
} from "../constants";
import { createInlineSurfaceEntry } from "../surface/definition";
import { applySurfaceToDockItem } from "../surface/view-model";
import { applyStatusOverlay } from "../status/model";
import { applyMediaAction } from "../components/media-action";
import type {
  DockAttention,
  DockItem,
  DockStatusDescriptor,
  SurfaceState,
  SurfaceViewModelOptions,
} from "../types";
import {
  DockContext,
  useDockActions,
  useDockHasMedia,
  useDockMediaActions,
  useDockSelector,
  useDockLoadingState as useLoadingState,
} from "../context";
import { resolveDockAttention } from "../model/state";
import { createDockTopology } from "../routing/model/topology";
import { useDockStatus } from "../status/hooks";
import {
  type DockBaseMatch,
  buildDockItems,
  isNotFoundItem,
  resolveBaseActiveItemMatch,
  selectPendingRouteItem,
} from "./model/items";

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
  return useMemo(
    () =>
      isHeld && selected ? { ...selected, isRoutePending: true } : selected,
    [isHeld, selected],
  );
}

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
}: {
  rawItems: DockItem[];
  dockItems: DockItem[];
  pathname: string;
  isNotFoundPage: boolean;
  surfaceState: SurfaceState;
  statusState: DockStatusDescriptor | null;
  hasMedia: boolean;
  toggleMedia: () => void;
  mediaAction: ComponentType | null;
  actionStackClass: string;
  surfaceActions: SurfaceViewModelOptions;
  isPageLoading: boolean;
  attention: DockAttention;
  baseActiveItem?: DockItem | null;
}): DockItem | null {
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

  if (attention?.kind === DOCK_ATTENTION_KIND.SURFACE)
    return applySurfaceToDockItem(
      baseActiveItem,
      surfaceState.activeSurfaceEntry,
      {
        ...surfaceActions,
        surfacePhase: surfaceState.surfacePhase,
        surfaceStack: surfaceState.surfaceStack,
      },
    );
  if (attention?.kind === DOCK_ATTENTION_KIND.STATUS && statusState?.isOverlay)
    return applyStatusOverlay(baseActiveItem, statusState);
  if (
    attention?.kind === DOCK_ATTENTION_KIND.HUD ||
    attention?.kind === DOCK_ATTENTION_KIND.OPERATION
  )
    return baseActiveItem;
  if (attention?.kind === DOCK_ATTENTION_KIND.STATUS && statusState)
    return applyStatusOverlay(baseActiveItem, statusState);

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
  const actionStackClass = useModuleTheme(dockTheme).slots.actionStack;
  const { toggle: toggleMedia } = useDockMediaActions();

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

  const isNotFoundPage = useMemo(
    () => rawItems.some(isNotFoundItem),
    [rawItems],
  );

  const dockItems = useMemo(
    () => buildDockItems({ rawItems, expanded, searchQuery, isNotFoundPage }),
    [rawItems, expanded, searchQuery, isNotFoundPage],
  );

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

  const activeIndex = useMemo(
    () => resolveActiveIndex({ dockItems, activeItem, pathname }),
    [dockItems, activeItem, pathname],
  );

  const topology = useMemo(
    () => createDockTopology(dockItems, { pathname }),
    [dockItems, pathname],
  );

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
