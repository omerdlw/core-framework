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
import { isSurfaceLayerShown } from "../lib/card";
import { getDockCardPadding } from "../model/layout";
import { resolveDockScene } from "../model/state";
import { getDockStackTransition, useDockMotion } from "../motion";
import { useDockBreadcrumbs } from "../routing/breadcrumbs";
import { useDockViewConnection } from "../routing/navigation";
import { useIsSurfaceExtensionsVisible } from "../surface/hooks/use-surface-extensions";
import type { DockCompactProps } from "../types";
import { useDock } from "./hooks/use-dock";
import {
  createDockCardProps,
  dismissSurfaceFromOutside,
  NO_FOCUSED_INDEX,
  OUTSIDE_DISMISS_HANDLED,
  resolveDockContentKey,
} from "./model/cards";
import { isNotFoundItem } from "./model/items";

const DEFAULT_COMPACT_KEY = "default";

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
  const { compact, contextActions, hud } = useDockSelector(
    (state) => ({
      compact: state.compact,
      contextActions: state.contextActions,
      hud: state.hud,
    }),
    (left, right) =>
      left.compact === right.compact &&
      left.contextActions === right.contextActions &&
      left.hud === right.hud,
  );
  const { clearHud, setCompact } = useDockActions();
  const [compactWidth, setCompactWidth] = useState(0);
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
  const isNotFound = Boolean(isNotFoundItem(activeItem));
  const isStatusActive = Boolean(activeItem?.isStatus || isNotFound);
  // A surface opened from the compact layout grows out of it and folds back
  // into it: while the surface is not drawn (its action dismissing, its body
  // collapsing, its header returning) the card keeps the compact row.
  const isSurfaceFacingPage = Boolean(
    activeItem?.isSurface && !isSurfaceLayerShown(activeItem),
  );
  // A status (signed out, offline…) keeps the compact row and shows there as
  // a one-line message; the not-found page keeps its full card.
  const isCompactStatus = Boolean(activeItem?.isStatus && !isNotFound);
  const isCompactActive =
    compact &&
    !expanded &&
    (!activeItem?.isSurface || isSurfaceFacingPage) &&
    (!isOverlayActive || isSurfaceFacingPage || isCompactStatus) &&
    !isHudActive &&
    (!isStatusActive || isCompactStatus) &&
    !isNotificationVisible;
  const dockMotion = useDockMotion();
  const compactPadding = getDockCardPadding(dockMotion.deck.padding);
  const shownStackWidth =
    isCompactActive && compactWidth > 0
      ? Math.min(compactWidth + compactPadding * 2, stackWidth)
      : stackWidth;
  const compactProps: DockCompactProps | null = isCompactActive
    ? {
        activeItem,
        contextCommands: contextActions,
        onWidthChange: setCompactWidth,
        setCompact,
      }
    : null;
  const contentKey = isCompactActive
    ? `compact:${activeItem?.path || DEFAULT_COMPACT_KEY}`
    : resolveDockContentKey(activeItem, isHudActive, hud);
  const { containerHeight, handleContentHeightChange } =
    useDockHeightController({
      contentKey,
      heightVar: dockMotion.deck.heightVar,
      // The compact row and an open surface are as tall as their content.
      fitContent: isCompactActive || isSurfaceLayerShown(activeItem),
      isHud: isHudActive,
      padding: dockMotion.deck.padding,
      setDockHeight,
      surfacePhase: activeItem?.surfacePhase,
    });
  const [stackSize, setStackSize] = useState({
    width: shownStackWidth,
    height: containerHeight,
    resizeDistance: 0,
  });
  if (
    stackSize.width !== shownStackWidth ||
    stackSize.height !== containerHeight
  ) {
    setStackSize({
      width: shownStackWidth,
      height: containerHeight,
      resizeDistance: Math.hypot(
        shownStackWidth - stackSize.width,
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
    compact: compactProps,
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
    stackWidth: shownStackWidth,
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
