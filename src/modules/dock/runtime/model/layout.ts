import type { DockItem } from "../../types";
import {
  findDockItemIndex,
  isSameItem,
  removeAncestorDuplicates,
  removeInactiveLoadingItems,
  reorderItemsWithActiveFirst,
  replaceActiveItem,
} from "../pipeline";

const NOT_FOUND_INDEX = -1;

function resolveDisplayActiveIndex(
  activeIndexForDisplay: number,
  reorderedCount: number,
) {
  if (activeIndexForDisplay !== NOT_FOUND_INDEX) return activeIndexForDisplay;
  return reorderedCount > 0 ? 0 : NOT_FOUND_INDEX;
}

/**
 * Orders and filters the dock items for display: the active item first, a
 * route-pending item held in front, loading leftovers and ancestors removed.
 */
export function computeDockLayout(
  dockItems: DockItem[] | undefined,
  activeItem: DockItem | null | undefined,
  pathname: string,
) {
  const registeredItems = dockItems || [];
  const registeredIndex = findDockItemIndex(
    registeredItems,
    activeItem ?? null,
    pathname,
  );
  const isHeldOutsideStack =
    registeredIndex === NOT_FOUND_INDEX && Boolean(activeItem?.isRoutePending);
  const items = isHeldOutsideStack
    ? [activeItem!, ...registeredItems]
    : registeredItems;
  const activeIndex = isHeldOutsideStack ? 0 : registeredIndex;
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
    displayActiveIndex: resolveDisplayActiveIndex(
      activeIndexForDisplay,
      reorderedItems.length,
    ),
  };
}
