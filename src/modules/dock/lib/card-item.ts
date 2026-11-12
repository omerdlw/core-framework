import { cn } from "@/foundation/recipes/cn";

import { DOCK_SURFACE_PHASE } from "../constants";
import type {
  DockDeckStacking,
  DockItem,
  DockTheme,
  DockVisualStyle,
  DockVisualStyleInput,
} from "../types";
import { ownsPathname } from "./card";

/** Layers an item's own style over a status style, section by section. */
export function mergeStatusStyle(
  itemStyle: DockVisualStyleInput | null | undefined,
  statusStyle: DockVisualStyleInput | null | undefined,
) {
  if (!statusStyle) return itemStyle;
  if (!itemStyle) return statusStyle;
  return {
    ...statusStyle,
    ...itemStyle,
    card: { ...statusStyle.card, ...itemStyle.card },
    icon: { ...statusStyle.icon, ...itemStyle.icon },
    title: { ...statusStyle.title, ...itemStyle.title },
    description: { ...statusStyle.description, ...itemStyle.description },
  };
}

/** Adds the theme's status class names to each section of a resolved style. */
export function applyStatusSlots(
  resolved: DockVisualStyle,
  slots: DockTheme["slots"],
): DockVisualStyle {
  return {
    ...resolved,
    card: {
      ...resolved.card,
      className: cn(slots.statusCard, resolved.card.className),
    },
    icon: {
      ...resolved.icon,
      className: cn(slots.statusIcon, resolved.icon.className),
    },
    title: {
      ...resolved.title,
      className: cn(slots.statusTitle, resolved.title.className),
    },
    description: {
      ...resolved.description,
      className: cn(slots.statusDescription, resolved.description.className),
    },
  };
}

/** True when the active item is a surface that is not restoring its header. */
export function isActiveSurfaceInProgress(
  activeItem: DockItem | null | undefined,
): boolean {
  return Boolean(
    activeItem?.isSurface &&
    activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
  );
}

/** How many stacked cards stay visible for the current status/extension state. */
export function resolveVisibleCardCount({
  expanded,
  hasExtensions,
  isStackHovered,
  item,
  stacking,
}: {
  expanded: boolean | undefined;
  hasExtensions: boolean;
  isStackHovered: boolean | undefined;
  item: DockItem;
  stacking: DockDeckStacking;
}): number {
  if (item.isStatus && !isStackHovered) return stacking.visible.status;
  if (hasExtensions && !expanded) return stacking.visible.extensions;
  return stacking.visible.stack;
}

/** True when the dock stack should lay out for an open (non-collapsing) surface. */
export function isStackSurfaceActive(
  activeItem: DockItem | null | undefined,
): boolean {
  return Boolean(
    activeItem?.isSurface &&
    activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.COLLAPSING_BODY &&
    activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
  );
}

/** Role flags for a card: which layer it belongs to and whether it shows the scrubber. */
export function resolveCardRoleFlags({
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
}: {
  activeItem: DockItem | null | undefined;
  expanded: boolean | undefined;
  hasMedia: boolean;
  hud: unknown;
  isActive: boolean;
  isHudActive: boolean;
  isStatusActive: boolean;
  isSurfaceActive: boolean;
  isTop: boolean;
  item: DockItem;
  pathname: string;
  statusStyle: unknown;
}) {
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
  return {
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    isTopHudActive,
    showVideoScrubber,
  };
}

/** Where a card sits in the stack: extension shelf, background or ghost. */
export function resolveCardStackFlags(
  expanded: boolean | undefined,
  position: number,
  hasExtensions: boolean,
  stacking: DockDeckStacking,
) {
  const isExtensionShelf = Boolean(
    !expanded && position === 1 && hasExtensions,
  );
  const isCollapsedBackgroundCard = Boolean(
    !expanded && position > 0 && !isExtensionShelf,
  );
  const isCollapsedGhostCard = Boolean(
    !expanded && position >= stacking.visible.stack && !isExtensionShelf,
  );
  return { isCollapsedBackgroundCard, isCollapsedGhostCard, isExtensionShelf };
}
