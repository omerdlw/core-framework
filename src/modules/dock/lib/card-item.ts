import { cn } from "@/foundation/recipes/cn";

import { DOCK_SURFACE_PHASE } from "../constants";
import type {
  DockDeckStacking,
  DockItem,
  DockTheme,
  DockVisualStyle,
  DockVisualStyleInput,
} from "../types";

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
