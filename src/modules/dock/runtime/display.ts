"use client";

import { usePathname } from "next/navigation";
import { type ComponentType, use, useEffect, useMemo, useState } from "react";

import { useRegistryEntries } from "@/core/kernel";
import {
  normalizePath,
  shallowEqual as areShallowCollectionsEqual,
} from "@/foundation/utils";
import { useTheme } from "@/react/theme";

import { applyMediaAction } from "../components/media-action";
import {
  DOCK_ATTENTION_KIND,
  DOCK_PENDING_ROUTE_HOLD_MS,
  dockTheme,
} from "../constants";
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
import { applyStatusOverlay } from "../status/model";
import { createInlineSurfaceEntry } from "../surface/definition";
import { applySurfaceToDockItem } from "../surface/view-model";
import type {
  DockAttention,
  DockItem,
  DockStatusDescriptor,
  SurfaceState,
  SurfaceViewModelOptions,
} from "../types";
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
  return useMemo(
    () =>
      isHeld && selected ? { ...selected, isRoutePending: true } : selected,
    [isHeld, selected],
  );
}

/**
 * Applies the item the dock is currently paying attention to (surface,
 * status, HUD or operation). Returns `undefined` when nothing has attention
 * and the item should be resolved normally.
 */
function applyAttentionToItem(
  baseActiveItem: DockItem,
  attention: DockAttention,
  surfaceState: SurfaceState,
  statusState: DockStatusDescriptor | null,
  surfaceActions: SurfaceViewModelOptions,
): DockItem | null | undefined {
  switch (attention?.kind) {
    case DOCK_ATTENTION_KIND.SURFACE:
      return applySurfaceToDockItem(
        baseActiveItem,
        surfaceState.activeSurfaceEntry,
        {
          ...surfaceActions,
          surfacePhase: surfaceState.surfacePhase,
          surfaceStack: surfaceState.surfaceStack,
        },
      );
    case DOCK_ATTENTION_KIND.STATUS:
      return statusState
        ? applyStatusOverlay(baseActiveItem, statusState)
        : undefined;
    case DOCK_ATTENTION_KIND.HUD:
    case DOCK_ATTENTION_KIND.OPERATION:
      return baseActiveItem;
    default:
      return undefined;
  }
}

interface ResolveActiveItemOptions {
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
  const actionStackClass = useTheme(dockTheme).slots.actionStack;
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
