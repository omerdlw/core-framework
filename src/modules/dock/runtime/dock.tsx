"use client";

import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useReducer,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useRequiredContext,
  useClickOutside,
  useIsFullscreenStateActive,
  useIsomorphicLayoutEffect,
} from "@/hooks";
import { normalizePath, shallowEqual } from "@/utils";
import {
  MAX_VISIBLE_STACKED_CARDS,
  DOCK_ATTENTION_KIND,
  DOCK_OPERATION_EVENTS,
  DOCK_OPERATION_MAX_ENTRIES,
  DOCK_OPERATION_STATUS,
  DOCK_SURFACE_PHASE,
} from "../constants";
import {
  findDockItemIndex,
  getIsItemActive,
  getItemKey,
  isSameItem,
  removeAncestorDuplicates,
  removeInactiveLoadingItems,
  reorderItemsWithActiveFirst,
  replaceActiveItem,
} from "./pipeline";
import {
  type DockItem,
  type DockNavigateOptions,
  type DockOperationInput,
  type DockActions,
  type DockRouteSnapshot,
  type DockViewBridge,
} from "../types";
import {
  useDockKeyboard,
  useDockRouteReset,
} from "../dom";
import {
  useDockHeightController,
  useDockViewport,
} from "../layout";
import {
  DockContext,
  useDockActions,
  useDockSelector,
  useDockNotificationVisible,
} from "../context";
import {
  useDockNavigation,
  useDockViewConnection,
} from "../routing/navigation";
import { useDockDisplay } from "./display";
import { createDockOperationHud } from "../hud";
import {
  createDockOperation,
  createDockOperationState,
  dockOperationReducer,
  resolveActiveDockOperation,
  resolveDockScene,
} from "../state";
import { useDockBreadcrumbs } from "../routing/breadcrumbs";
import { useIsSurfaceExtensionsVisible } from "../surface/hooks";
import {
  DOCK_CARD_EXPAND_TRANSITION,
  DOCK_STACK_TRANSITION,
  DOCK_SURFACE_RESIZE_TRANSITION,
  getDockSurfaceResizeTransition,
} from "../motion";
import { report } from "@/utils";

export function useDockLayout({
  dockItems,
  activeItem,
  pathname: overridePathname,
}: {
  dockItems?: DockItem[];
  activeItem?: DockItem | null;
  pathname?: string;
} = {}) {
  const routePathname = usePathname();
  const pathname = overridePathname || routePathname;

  const { displayItems, displayActiveIndex } = useMemo(() => {
    const items = dockItems || [];
    const activeIndex = findDockItemIndex(items, activeItem ?? null, pathname);
    const itemsWithActiveItem = replaceActiveItem(
      items,
      activeIndex,
      activeItem ?? null,
    );

    const reorderedItems = reorderItemsWithActiveFirst(
      itemsWithActiveItem,
      activeIndex,
    );
    const filteredItems = removeInactiveLoadingItems(
      reorderedItems,
      activeItem ?? null,
    );
    const deduplicatedItems = removeAncestorDuplicates(filteredItems);
    const activeIndexForDisplay = deduplicatedItems.findIndex((item) =>
      isSameItem(item, activeItem),
    );

    return {
      displayItems: deduplicatedItems,
      displayActiveIndex:
        activeIndexForDisplay !== -1
          ? activeIndexForDisplay
          : reorderedItems.length > 0
            ? 0
            : -1,
    };
  }, [pathname, dockItems, activeItem]);

  return {
    displayItems,
    activeIndex: displayActiveIndex,
    MAX_VISIBLE_STACKED_CARDS,
  };
}

export function useDock() {
  const {
    closeSurface,
    setExpanded: setExpandedState,
    setDockHeight,
    setSearchQuery,
  } = useDockActions();
  const { isExpanded, searchQuery } = useDockSelector(
    (state) => ({
      isExpanded: state.expanded,
      searchQuery: state.searchQuery,
    }),
    shallowEqual,
  );

  const [isHovered, setIsHovered] = useState(false);
  const { guards } = useRequiredContext(DockContext, "useDock", "DockProvider");
  const core = useDockNavigation();

  const {
    activeTransaction,
    cancelDock,
    lastTransaction,
    locationKey,
    navigate: navigateWithGuards,
    pathname,
  } = core;

  const effectivePathname = activeTransaction?.to
    ? normalizePath(activeTransaction.to)
    : pathname;
  const display = useDockDisplay(effectivePathname);
  const { dockItems, activeItem, statusState, attention, topology } = display;
  const isHudModeActive =
    attention?.kind === DOCK_ATTENTION_KIND.HUD ||
    attention?.kind === DOCK_ATTENTION_KIND.OPERATION;
  const isSurfaceActive = Boolean(activeItem?.isSurface);
  const activeItemHasAction = Boolean(activeItem?.action);

  const clearHoverState = useCallback(() => setIsHovered(false), []);

  const setExpanded = useCallback(
    (nextValue: boolean | ((prev: boolean) => boolean)) => {
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(isExpanded) : nextValue;
      if (isSurfaceActive && resolvedValue) return;
      setExpandedState(resolvedValue);
    },
    [isExpanded, isSurfaceActive, setExpandedState],
  );

  const wasSurfaceActiveRef = useRef(false);
  useEffect(() => {
    if (isSurfaceActive) {
      wasSurfaceActiveRef.current = true;
      return;
    }
    if (wasSurfaceActiveRef.current) {
      wasSurfaceActiveRef.current = false;
      clearHoverState();
    }
  }, [clearHoverState, isSurfaceActive]);

  useEffect(() => {
    if (isSurfaceActive && isExpanded) setExpandedState(false);
  }, [isExpanded, isSurfaceActive, setExpandedState]);

  const navigate = useCallback(
    async (href: string, options?: DockNavigateOptions) => {
      if (!href) return false;
      const isUnguarded = Boolean(options?.force) || guards.count() === 0;
      const navigationPromise = navigateWithGuards(href, options);
      if (isUnguarded) {
        setExpanded(false);
        setSearchQuery("");
        clearHoverState();
      }
      const didNavigate = await navigationPromise;
      if (!didNavigate) return didNavigate;
      if (!isUnguarded) {
        setExpanded(false);
        setSearchQuery("");
        clearHoverState();
      }
      return didNavigate;
    },
    [clearHoverState, guards, navigateWithGuards, setExpanded, setSearchQuery],
  );

  const { displayItems, activeIndex: layoutActiveIndex } = useDockLayout({
    dockItems,
    activeItem,
    pathname: effectivePathname,
  });

  useDockRouteReset(pathname, () => {
    setExpanded(false);
    setSearchQuery("");
    setIsHovered(false);
  });

  return {
    dockItems: displayItems,
    activeItem,
    activeIndex: layoutActiveIndex,
    statusState,
    attention,
    topology,
    dockTransaction: activeTransaction,
    lastDockTransaction: lastTransaction,
    navigate,
    locationKey,
    pathname,
    cancelDock,
    closeSurface,
    expanded: isExpanded,
    setExpanded,
    setDockHeight,
    setSearchQuery,
    isHovered,
    setIsHovered,
    searchQuery,
    activeItemHasAction,
    isHudActive: isHudModeActive,
  };
}

export function useDockExpansion() {
  const [expanded, setExpandedState] = useState(false);

  const setExpanded = useCallback(
    (nextValue: boolean | ((prev: boolean) => boolean)) =>
      setExpandedState((prev) =>
        Boolean(typeof nextValue === "function" ? nextValue(prev) : nextValue),
      ),
    [],
  );
  const collapse = useCallback(() => setExpandedState(false), []);
  const expand = useCallback(() => setExpandedState(true), []);
  const toggle = useCallback(() => setExpandedState((prev) => !prev), []);

  const actions = useMemo(
    () => ({ collapse, expand, setExpanded, toggle }),
    [collapse, expand, setExpanded, toggle],
  );

  return { actions, expanded };
}

export function useDockOperationState() {
  const [operationState, dispatchOperation] = useReducer(
    dockOperationReducer,
    undefined,
    createDockOperationState,
  );
  const operationIdRef = useRef(0);
  const operationStateRef = useRef(operationState);
  useIsomorphicLayoutEffect(() => {
    operationStateRef.current = operationState;
  }, [operationState]);

  const start = useCallback((input: DockOperationInput = {}) => {
    const operation = createDockOperation({
      ...input,
      id: input.id ?? `dock-operation-${++operationIdRef.current}`,
    });
    if (!operation) return null;
    dispatchOperation({
      maxEntries: DOCK_OPERATION_MAX_ENTRIES,
      operation,
      type: DOCK_OPERATION_EVENTS.START,
    });
    return operation;
  }, []);

  const update = useCallback(
    (id: string | number, patch: Partial<DockOperationInput> = {}) => {
      if (id == null) return false;
      dispatchOperation({ id, patch, type: DOCK_OPERATION_EVENTS.UPDATE });
      return true;
    },
    [],
  );

  const complete = useCallback(
    (id: string | number, result: unknown = null) => {
      if (id == null) return false;
      dispatchOperation({ id, result, type: DOCK_OPERATION_EVENTS.COMPLETE });
      return true;
    },
    [],
  );

  const cancel = useCallback((id: string | number, result: unknown = null) => {
    if (id == null) return false;
    const operation = operationStateRef.current.entries.find(
      (entry) =>
        entry.id === String(id) &&
        entry.status === DOCK_OPERATION_STATUS.PENDING,
    );
    if (!operation) return false;
    if (typeof operation.onCancel === "function") {
      Promise.resolve(operation.onCancel(result)).catch((error) =>
        report("Dock operation cancellation", error),
      );
    }
    dispatchOperation({ id, result, type: DOCK_OPERATION_EVENTS.CANCEL });
    return true;
  }, []);

  const clear = useCallback(
    (id: string | number | null = null) =>
      dispatchOperation({ id, type: DOCK_OPERATION_EVENTS.CLEAR }),
    [],
  );

  const operationActions = useMemo(
    () => ({ cancel, clear, complete, start, update }),
    [cancel, clear, complete, start, update],
  );

  const activeOperation = useMemo(
    () => resolveActiveDockOperation(operationState),
    [operationState],
  );
  const pendingCount = useMemo(
    () =>
      operationState.entries.filter(
        (o) => o.status === DOCK_OPERATION_STATUS.PENDING,
      ).length,
    [operationState.entries],
  );
  const operationHud = useMemo(
    () =>
      createDockOperationHud(activeOperation, {
        onCancel: cancel,
        pendingCount,
      }),
    [activeOperation, cancel, pendingCount],
  );

  return { activeOperation, operationActions, operationHud, operationState };
}

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

export function useDockModel() {
  const {
    activeItem,
    dockItems,
    setDockHeight,
    setIsHovered,
    setExpanded,
    activeIndex,
    isHudActive,
    expanded,
    locationKey,
    navigate,
    pathname,
  } = useDock();
  useDockViewConnection({ activeItem, locationKey, navigate, pathname });
  const isFullscreenStateActive = useIsFullscreenStateActive();
  const { contextActions, hud } = useDockSelector(
    (state) => ({
      contextActions: state.contextActions,
      hud: state.hud,
    }),
    (left, right) =>
      left.contextActions === right.contextActions && left.hud === right.hud,
  );
  const { clearHud } = useDockActions();
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const isNotificationVisible = useDockNotificationVisible();
  const dockRef = useRef<HTMLDivElement>(null);
  const { portalTarget, stackWidth } = useDockViewport(activeItem);
  const clearHoverState = useCallback(() => {
    setIsStackHovered(false);
    setIsHovered(false);
  }, [setIsHovered]);
  const isSurfaceClosing =
    activeItem?.surfacePhase === DOCK_SURFACE_PHASE.COLLAPSING_BODY ||
    activeItem?.surfacePhase === DOCK_SURFACE_PHASE.RESTORING_HEADER;
  const isOverlayActive = Boolean(activeItem?.isOverlay && !isSurfaceClosing);
  const isBackdropVisible =
    !isFullscreenStateActive && (expanded || isOverlayActive);
  const { breadcrumbs } = useDockBreadcrumbs();
  const hasBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 1);
  const scene = resolveDockScene({
    expanded,
    hasBreadcrumbs,
    isHudActive,
    isNotificationVisible,
    isOverlayActive,
  });
  const isBreadcrumbsCardVisible = scene.companion === "breadcrumbs";
  const isSubCardVisible = scene.isCompanionVisible;
  const isExtensionsVisible = useIsSurfaceExtensionsVisible(activeItem);
  const contentKey = activeItem?.isSurface
    ? `surface:${activeItem.surfaceId ?? activeItem.path ?? "active"}`
    : isHudActive
      ? `hud:${hud?.id || "active"}`
      : `route:${activeItem?.path || activeItem?.name || "default"}`;
  const { containerHeight, handleContentHeightChange } =
    useDockHeightController({
      contentKey,
      isHud: isHudActive,
      setDockHeight,
      surfacePhase: activeItem?.surfacePhase,
    });
  const [stackSize, setStackSize] = useState({
    width: stackWidth,
    height: containerHeight,
    resizeDistance: 0,
  });
  if (stackSize.width !== stackWidth || stackSize.height !== containerHeight) {
    setStackSize({
      width: stackWidth,
      height: containerHeight,
      resizeDistance: Math.hypot(
        stackWidth - stackSize.width,
        containerHeight - stackSize.height,
      ),
    });
  }
  const surfaceResizeDistance = stackSize.resizeDistance;
  const handleOutsideDismiss = useCallback(() => {
    if (activeItem?.isSurface) {
      if (activeItem.dismissible === false) return;
      if (typeof activeItem.closeAllSurfaces === "function") {
        activeItem.closeAllSurfaces();
        return;
      }
      if (typeof activeItem.closeSurface === "function") {
        activeItem.closeSurface();
        return;
      }
    }
    if (isOverlayActive) return;
    setExpanded(false);
  }, [activeItem, isOverlayActive, setExpanded]);
  useDockKeyboard({
    expanded,
    focusedIndex,
    isOverlayActive,
    navigate,
    dockItems,
    setExpanded,
    setFocusedIndex,
  });
  useClickOutside(dockRef, handleOutsideDismiss);
  useEffect(() => {
    queueMicrotask(() => {
      clearHoverState();
      setFocusedIndex(expanded ? activeIndex : -1);
    });
  }, [activeIndex, clearHoverState, expanded]);
  useEffect(() => {
    if (!isFullscreenStateActive) return;
    queueMicrotask(() => {
      setExpanded(false);
      clearHoverState();
    });
  }, [clearHoverState, isFullscreenStateActive, setExpanded]);
  const isNotFound = Boolean(
    activeItem?.isNotFound ||
    activeItem?.path === "not-found" ||
    activeItem?.type === "NOT_FOUND",
  );
  const isStatusActive = Boolean(activeItem?.isStatus || isNotFound);
  const statusStyle =
    isStatusActive && !isNotFound ? activeItem?.style || null : null;
  const visibleDockItems = dockItems;
  const positionedDockItems = visibleDockItems
    .map((item, index) => ({
      item,
      key: getItemKey(item, index),
      position: index,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const dockCardProps = positionedDockItems.map(({ item, key, position }) => {
    const isTop = position === 0;
    const isActive = getIsItemActive(item, activeItem);
    const canTopCardPreview = !isStatusActive;

    const handleMouseEnter = () => {
      if (expanded) setFocusedIndex(position);
      if (!isTop || !canTopCardPreview) return;
      setIsStackHovered(true);
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      if (expanded) setFocusedIndex(-1);
      if (!isTop || !canTopCardPreview) return;
      setIsStackHovered(false);
      setIsHovered(false);
    };

    const handleClick = () => {
      if (item.isOverlay || isStatusActive || item.isStatus) return;
      if (!expanded) {
        clearHoverState();
        setExpanded(true);
        return;
      }
      const targetPath = item.targetPath || item.path;
      if (targetPath)
        navigate(targetPath, {
          item,
        });
    };

    return {
      key,
      item,
      link: item,
      activeItem,
      expanded,
      position,
      isTop,
      isActive,
      isStackHovered,
      hasExtensions: isExtensionsVisible,
      isSurfaceActive: Boolean(
        activeItem?.isSurface &&
        activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
      ),
      statusStyle,
      isStatusActive,
      isHudActive,
      hud,
      clearHud,
      contextCommands: contextActions,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onContentHeightChange: isTop ? handleContentHeightChange : null,
    };
  });
  const dockStackTransition = useMemo(() => {
    if (activeItem?.surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY) {
      return DOCK_CARD_EXPAND_TRANSITION;
    }
    if (
      activeItem?.surfacePhase === DOCK_SURFACE_PHASE.OPEN ||
      activeItem?.surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
    ) {
      return surfaceResizeDistance > 0
        ? getDockSurfaceResizeTransition(surfaceResizeDistance)
        : DOCK_SURFACE_RESIZE_TRANSITION;
    }
    if (
      activeItem?.surfacePhase === DOCK_SURFACE_PHASE.COLLAPSING_BODY ||
      activeItem?.surfacePhase === DOCK_SURFACE_PHASE.RESTORING_HEADER
    ) {
      return DOCK_CARD_EXPAND_TRANSITION;
    }
    return expanded ? DOCK_CARD_EXPAND_TRANSITION : DOCK_STACK_TRANSITION;
  }, [activeItem?.surfacePhase, expanded, surfaceResizeDistance]);

  return {
    activeItem,
    dockItems,
    expanded,
    navigate,
    isFullscreenStateActive,
    dockRef,
    portalTarget,
    stackWidth,
    isOverlayActive,
    isBackdropVisible,
    isBreadcrumbsCardVisible,
    isSubCardVisible,
    isExtensionsVisible,
    containerHeight,
    dockCardProps,
    dockStackTransition,
  };
}
