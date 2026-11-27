"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
  useRef,
  useState,
} from "react";

import { useModule } from "@/core/kernel";
import { useGlobalEvent } from "@/react/hooks";

import { DOCK_EVENTS, DOCK_SURFACE_PHASE } from "../constants";
import { useDockHasMedia } from "../context";
import { shouldRenderInlineAction } from "../items/pipeline";
import {
  getDockCardDelay,
  getDockHeaderRestoreVariants,
  useDockMotion,
} from "../motion";
import { resolveDockRoutePolicy } from "../routing/policy";
import { useRoutePrefetch } from "../routing/prefetch";
import { getItemMeasurementKey, getRouteMeasurementKey } from "../stack/layout";
import { useElementHeight } from "../stack/use-height";
import {
  getDockItemCardProps,
  resolveDockVisualStyle,
  useDockTheme,
} from "../theme";
import type { DockBadgeState, DockCardItemProps, DockItem } from "../types";
import {
  applyStatusSlots,
  type DockActionSlot,
  isRenderableAction,
  isSurfaceLayerShown,
  mergeStatusStyle,
  ownsPathname,
  resolveCardRoleFlags,
  resolveCardStackFlags,
  resolveVisibleCardCount,
} from "./model";

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
  const {
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    isTopHudActive,
    showVideoScrubber,
  } = resolveCardRoleFlags({
    activeItem,
    expanded,
    hasMedia,
    hud,
    isActive,
    isHudActive,
    isStatusActive,
    isSurfaceActive,
    isTop,
    item,
    pathname,
    statusStyle,
  });
  const badge = useDockBadge(item.name?.toLowerCase(), item.badge);
  const actionSlot = useActionSlot(item, pathname, { isTop });
  const cardContentRef = useRef<HTMLDivElement>(null);
  const showBorder = expanded ? isHovered : isHovered || isStackHovered;
  const effectiveStyle = mergeStatusStyle(item.style, statusStyle);
  const theme = useDockTheme();
  const isStatusCard = Boolean(item.isStatus || item.isNotFound || statusStyle);
  const resolvedStyle = resolveDockVisualStyle(effectiveStyle, {
    isActive,
    isHovered: showBorder,
  });
  const itemStyle = isStatusCard
    ? applyStatusSlots(resolvedStyle, theme.slots)
    : resolvedStyle;
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
  const headerRestoreVariants = getDockHeaderRestoreVariants(
    dockMotion,
    item.surfacePhase,
  );
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
  const handleMouseEnter = () => {
    if (item.isOverlay) return;
    setIsHovered(true);
    if (
      resolveDockRoutePolicy({ href: item.path ?? "", item }).prefetch &&
      item.path
    )
      prefetchRoute(item.path);
    if (!expanded) onMouseEnter?.();
  };
  // Leaving always clears the hover, even while an overlay (a surface) holds
  // the card: otherwise the stack peek it started outlives the surface.
  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!expanded) onMouseLeave?.();
    if (item.isOverlay) return;
    if (item.path) cancelRoutePrefetch(item.path);
  };
  const handleFocus = () => {
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
  };
  const handleBlur = () => {
    if (item.isOverlay) return;
    setIsHovered(false);
    onMouseLeave?.();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick?.(event);
  };
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop !== 0) event.currentTarget.scrollTop = 0;
  };
  const { isCollapsedBackgroundCard, isCollapsedGhostCard, isExtensionShelf } =
    resolveCardStackFlags(
      expanded,
      position,
      hasExtensions,
      dockMotion.deck.stacking,
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
  const cardDelay = getDockCardDelay(dockMotion, {
    expanded,
    isStackHovered,
    position,
  });

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

export function useActionSlot(
  item: DockItem,
  pathname: string,
  { isTop = false }: { isTop?: boolean } = {},
): DockActionSlot {
  const { isLoading, path, isStatus, isSurface, surfacePhase } = item;
  const isOverlay = Boolean(item.isOverlay && !isSurface);
  const action = isSurface ? item.restingAction : item.action;
  const showsSurface = isSurfaceLayerShown({ isSurface, surfacePhase });
  const hasMedia = useDockHasMedia();
  // A held route item keeps its own action until the next page replaces it.
  const actionPathname = item.isRoutePending && path ? path : pathname;

  if (isLoading || (isOverlay && !isStatus) || showsSurface) return null;
  if (isStatus) {
    return action && isRenderableAction(action)
      ? { kind: "action", action }
      : null;
  }
  if (isTop && hasMedia && ownsPathname(path, actionPathname)) {
    return { kind: "media" };
  }
  if (!isTop && !isOverlay) return null;

  if (
    !shouldRenderInlineAction(
      { action, isLoading, isOverlay, path },
      actionPathname,
    )
  ) {
    return null;
  }
  return action && isRenderableAction(action)
    ? { kind: "action", action }
    : null;
}

export function useDockBadge(
  dockKey?: string | null,
  initialBadge?: ReactNode,
): DockBadgeState {
  const [badge, setBadge] = useState<DockBadgeState>({
    visible: Boolean(initialBadge),
    value: initialBadge as DockBadgeState["value"],
  });

  useGlobalEvent(
    dockKey ? DOCK_EVENTS.UPDATE_BADGE : null,
    (data?: {
      color?: string;
      key?: string;
      value?: string | number | null;
    }) => {
      if (data && data.key === dockKey) {
        setBadge({
          visible: data.value != null && data.value !== "",
          color: data.color,
          value: data.value,
        });
      }
    },
  );

  return badge;
}
