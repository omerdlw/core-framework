"use client";

import type { TargetAndTransition } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type UIEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { useModule } from "@/core/kernel";

import { DOCK_SURFACE_PHASE } from "../constants";
import { useDockHasMedia } from "../context";
import { isSurfaceLayerShown, ownsPathname } from "../lib/card";
import {
  applyStatusSlots,
  isActiveSurfaceInProgress,
  mergeStatusStyle,
  resolveVisibleCardCount,
} from "../lib/card-item";
import { getDockItemCardProps, resolveDockVisualStyle } from "../lib/styles";
import { getItemMeasurementKey, getRouteMeasurementKey } from "../model/layout";
import { getDockCardDelay, getDockPhaseMotion, useDockMotion } from "../motion";
import { useRoutePrefetch } from "../routing/hooks/use-route-prefetch";
import { resolveDockRoutePolicy } from "../routing/model/policy";
import type { DockCardItemProps } from "../types";
import { useActionSlot } from "./use-action-slot";
import { useDockBadge } from "./use-badge";
import { useDockTheme } from "./use-dock-theme";
import { useElementHeight } from "./use-element-height";

export function useDockCardItemModel({
  activeItem = null,
  onContentHeightChange,
  isStackHovered,
  onMouseEnter,
  onMouseLeave,
  expanded,
  hasExtensions = false,
  position,
  onClick,
  isTop = false,
  item: propItem,
  link,
  isActive = false,
  statusStyle = null,
  isStatusActive = false,
  isHudActive = false,
  isSurfaceActive = false,
  hud = null,
}: DockCardItemProps) {
  const item = (propItem ?? link)!;
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useModule("navigation");
  const { cancelRoutePrefetch, prefetchRoute } = useRoutePrefetch(router, {
    navigator: navigation?.actions,
  });
  const hasMedia = useDockHasMedia();
  const isTopHudActive = Boolean(isTop && isHudActive);
  const isCurrentActive = Boolean(
    !item.disabled && !item.isInactive && (expanded || isTop || isActive),
  );
  const isCurrentHud = Boolean(
    isHudActive || isTopHudActive || Boolean(hud) || Boolean(item.isHud),
  );
  const isCurrentStatus = Boolean(
    isStatusActive ||
    Boolean(item.isStatus) ||
    Boolean(statusStyle) ||
    Boolean(item.isNotFound),
  );
  const isCurrentSurface = Boolean(
    isSurfaceActive ||
    Boolean(item.isSurface) ||
    isActiveSurfaceInProgress(activeItem),
  );
  const isHeaderRestoring =
    item.surfacePhase === DOCK_SURFACE_PHASE.RESTORING_HEADER;
  const showVideoScrubber = Boolean(
    isTop &&
    hasMedia &&
    ownsPathname(item.path, pathname) &&
    (!item.isSurface || isHeaderRestoring) &&
    !item.isStatus,
  );
  const badge = useDockBadge(item.name?.toLowerCase(), item.badge);
  const actionSlot = useActionSlot(item, pathname, { isTop });
  const cardContentRef = useRef<HTMLDivElement>(null);
  const showBorder = expanded ? isHovered : isHovered || isStackHovered;
  const effectiveStyle = useMemo(() => {
    return mergeStatusStyle(item.style, statusStyle);
  }, [item.style, statusStyle]);
  const theme = useDockTheme();
  const isStatusCard = Boolean(item.isStatus || item.isNotFound || statusStyle);
  const itemStyle = useMemo(() => {
    const resolved = resolveDockVisualStyle(effectiveStyle, {
      isActive,
      isHovered: showBorder,
    });
    if (!isStatusCard) return resolved;
    return applyStatusSlots(resolved, theme.slots);
  }, [effectiveStyle, isActive, isStatusCard, showBorder, theme]);
  const showsSurfaceLayer = isSurfaceLayerShown(item);
  const renderedActionSlot =
    showsSurfaceLayer || isTopHudActive ? null : actionSlot;
  const isActionDismissed = Boolean(
    item.isSurface &&
    item.surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION,
  );
  const hasNestedInteractiveContent = Boolean(
    renderedActionSlot || showsSurfaceLayer,
  );
  const dockMotion = useDockMotion();
  const headerRestoreVariants = useMemo(() => {
    const { headerRestore } = dockMotion.variants;
    const visible = headerRestore.visible as TargetAndTransition;
    return {
      hidden: headerRestore.hidden,
      visible: {
        ...visible,
        transition:
          getDockPhaseMotion(dockMotion, item.surfacePhase).headerReturn ??
          visible.transition,
      },
      exit: headerRestore.exit,
    };
  }, [dockMotion, item.surfacePhase]);
  useElementHeight(
    onContentHeightChange,
    cardContentRef,
    isTop,
    getRouteMeasurementKey(
      pathname,
      getItemMeasurementKey({
        link: item,
        expanded: Boolean(expanded),
        isHovered,
        isStackHovered: Boolean(isStackHovered),
        isHud: isTopHudActive,
      }),
    ),
  );
  const handleMouseEnter = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(true);
    if (
      resolveDockRoutePolicy({ href: item.path ?? "", item }).prefetch &&
      item.path
    )
      prefetchRoute(item.path);
    if (!expanded) onMouseEnter?.();
  }, [expanded, item, onMouseEnter, prefetchRoute]);
  const handleMouseLeave = useCallback(() => {
    if (item.isOverlay) return;
    if (item.path) cancelRoutePrefetch(item.path);
    setIsHovered(false);
    if (!expanded) onMouseLeave?.();
  }, [cancelRoutePrefetch, expanded, item, onMouseLeave]);
  const handleFocus = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(true);
    const targetHref = item.targetPath || item.path;
    if (
      resolveDockRoutePolicy({ href: targetHref ?? "", item }).prefetch &&
      targetHref
    ) {
      prefetchRoute(targetHref, { immediate: true });
    }
    onMouseEnter?.();
  }, [item, onMouseEnter, prefetchRoute]);
  const handleBlur = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(false);
    onMouseLeave?.();
  }, [item, onMouseLeave]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick?.(event);
    },
    [onClick],
  );
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop !== 0) event.currentTarget.scrollTop = 0;
  }, []);
  const isExtensionShelf = Boolean(
    !expanded && position === 1 && hasExtensions,
  );
  const isCollapsedBackgroundCard = Boolean(
    !expanded && position > 0 && !isExtensionShelf,
  );
  const isCollapsedGhostCard = Boolean(
    !expanded &&
    position >= dockMotion.deck.stacking.visible.stack &&
    !isExtensionShelf,
  );
  const {
    className: cardClassName,
    data: cardData,
    style: cardStyle,
    motionValues,
  } = getDockItemCardProps({
    expanded,
    position,
    cardStyle: itemStyle.card,
    cardScale: itemStyle.scale,
    theme,
    isAnchoredToBottom: item.isSurface,
    stacking: dockMotion.deck.stacking,
    visibleCount: resolveVisibleCardCount({
      expanded,
      hasExtensions,
      isStackHovered,
      item,
      stacking: dockMotion.deck.stacking,
    }),
    hasExtensions,
  });
  const cardDelay = useMemo(
    () => getDockCardDelay(dockMotion, { expanded, isStackHovered, position }),
    [dockMotion, expanded, isStackHovered, position],
  );

  return {
    item,
    pathname,
    isTopHudActive,
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    showVideoScrubber,
    badge,
    cardContentRef,
    itemStyle,
    renderedActionSlot,
    isActionDismissed,
    showsSurfaceLayer,
    hasNestedInteractiveContent,
    headerRestoreVariants,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleScroll,
    isExtensionShelf,
    isCollapsedBackgroundCard,
    isCollapsedGhostCard,
    cardClassName,
    cardData,
    cardStyle,
    motionValues,
    cardDelay,
  };
}
