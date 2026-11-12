"use client";

import { useEffect, useRef, useState } from "react";

import { useClickOutside, useIsFullscreenStateActive } from "@/react/hooks";

import { DOCK_SURFACE_PHASE } from "../constants";
import {
  useDockActions,
  useDockNotificationVisible,
  useDockSelector,
} from "../context";
import { useDockHeightController } from "../hooks/use-dock-height-controller";
import { useDockKeyboard } from "../hooks/use-dock-keyboard";
import { useDockViewport } from "../hooks/use-dock-viewport";
import { resolveDockScene } from "../model/state";
import { getDockStackTransition, useDockMotion } from "../motion";
import { useDockBreadcrumbs } from "../routing/breadcrumbs";
import { useDockViewConnection } from "../routing/navigation";
import { useIsSurfaceExtensionsVisible } from "../surface/hooks/use-surface-extensions";
import { useDock } from "./hooks/use-dock";
import {
  createDockCardProps,
  dismissSurfaceFromOutside,
  NO_FOCUSED_INDEX,
  OUTSIDE_DISMISS_HANDLED,
  resolveDockContentKey,
} from "./model/cards";
import { isNotFoundItem } from "./model/items";

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
  const [focusedIndex, setFocusedIndex] = useState(NO_FOCUSED_INDEX);
  const isNotificationVisible = useDockNotificationVisible();
  const dockRef = useRef<HTMLDivElement>(null);
  const { portalTarget, stackWidth } = useDockViewport(activeItem);
  // Compiled: the compiler keeps this and handleOutsideDismiss stable while
  // their inputs are. The effects below clear hover state inline instead of
  // depending on it.
  const clearHoverState = () => {
    setIsStackHovered(false);
    setIsHovered(false);
  };
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
  const contentKey = resolveDockContentKey(activeItem, isHudActive, hud);
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
  const handleOutsideDismiss = () => {
    const outcome = dismissSurfaceFromOutside(activeItem);
    if (outcome === OUTSIDE_DISMISS_HANDLED) return;
    if (isOverlayActive) return;
    setExpanded(false);
  };
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
      setIsStackHovered(false);
      setIsHovered(false);
      setFocusedIndex(expanded ? activeIndex : NO_FOCUSED_INDEX);
    });
  }, [activeIndex, expanded, setIsHovered]);
  useEffect(() => {
    if (!isFullscreenStateActive) return;
    queueMicrotask(() => {
      setExpanded(false);
      setIsStackHovered(false);
      setIsHovered(false);
    });
  }, [isFullscreenStateActive, setExpanded, setIsHovered]);
  const isNotFound = Boolean(isNotFoundItem(activeItem));
  const isStatusActive = Boolean(activeItem?.isStatus || isNotFound);
  const statusStyle =
    isStatusActive && !isNotFound ? activeItem?.style || null : null;
  const dockCardProps = createDockCardProps({
    activeItem,
    clearHud,
    clearHoverState,
    contextActions,
    dockItems,
    expanded,
    handleContentHeightChange,
    hud,
    isExtensionsVisible,
    isHudActive,
    isStackHovered,
    isStatusActive,
    navigate,
    setExpanded,
    setFocusedIndex,
    setIsHovered,
    setIsStackHovered,
    statusStyle,
  });
  const dockMotion = useDockMotion();
  const dockStackTransition = getDockStackTransition(dockMotion, {
    expanded,
    resizeDistance: surfaceResizeDistance,
    surfacePhase: activeItem?.surfacePhase ?? null,
  });

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
