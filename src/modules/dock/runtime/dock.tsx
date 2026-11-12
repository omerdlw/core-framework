"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside, useIsFullscreenStateActive } from "@/react/hooks";
import { DOCK_SURFACE_PHASE } from "../constants";
import { getIsItemActive, getItemKey } from "./pipeline";
import { useDockKeyboard } from "../hooks/use-dock-keyboard";
import { useDockHeightController } from "../hooks/use-dock-height-controller";
import { useDockViewport } from "../hooks/use-dock-viewport";
import {
  useDockActions,
  useDockNotificationVisible,
  useDockSelector,
} from "../context";
import { useDockViewConnection } from "../routing/navigation";
import { resolveDockScene } from "../model/state";
import { useDockBreadcrumbs } from "../routing/breadcrumbs";
import { useIsSurfaceExtensionsVisible } from "../surface/hooks/use-surface-extensions";
import { getDockStackTransition, useDockMotion } from "../motion";
import { useDock } from "./hooks/use-dock";

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
        void navigate(targetPath, {
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
  const dockMotion = useDockMotion();
  const dockStackTransition = useMemo(
    () =>
      getDockStackTransition(dockMotion, {
        expanded,
        resizeDistance: surfaceResizeDistance,
        surfacePhase: activeItem?.surfacePhase ?? null,
      }),
    [activeItem?.surfacePhase, dockMotion, expanded, surfaceResizeDistance],
  );

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
